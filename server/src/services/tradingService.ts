import { getStockDetail } from "../data/stocks";
import { Holding, PortfolioSummary, Trade, TradeSide } from "../types";
import {
  Paise,
  formatPaiseINR,
  mulPaise,
  paiseToRupees,
  percentOf,
  proportionalShare,
  rupeesToPaise,
} from "../utils/money";

/**
 * Trading engine + IN-MEMORY state.
 * Everything here resets whenever the server restarts.
 * Later you can replace the Maps/arrays inside TradingEngine with PostgreSQL + Prisma.
 *
 * ACCOUNTING RULES
 * - Money is stored as whole paise (integers). Rupees only appear in API output.
 * - Each position stores its COST BASIS: the total paise paid for the shares still held
 *   (including any buy fees). Average cost is just costBasis / quantity, for display.
 * - BUY:  cash -= gross + fee;  position cost basis += gross + fee.
 * - SELL: cash += gross - fee;  the part of the cost basis for the shares sold is released
 *         (proportionally; a full sell releases all of it);
 *         realized P&L = (gross - fee) - released cost basis.
 * - Unrealized P&L = market value - remaining cost basis.
 * - Net worth = cash + market value of holdings.
 * - Total P&L = net worth - starting balance = realized P&L + unrealized P&L (always, exactly).
 * - Fees: the engine has a fee hook (FeeModel). It returns 0 today. Because fees are already
 *   part of the formulas above, turning them on later keeps everything reconciled.
 */

export const STARTING_BALANCE = 1_000_000; // rupees (₹10,00,000)
export const MAX_ORDER_QUANTITY = 1_000_000; // shares per order
const CLIENT_ORDER_ID_PATTERN = /^[A-Za-z0-9_-]{1,64}$/;

export class TradeError extends Error {
  status: number;
  constructor(message: string, status = 400) {
    super(message);
    this.name = "TradeError";
    this.status = status;
  }
}

/** Where the engine gets prices from. `price` is in rupees. */
export interface Quote {
  name: string;
  price: number;
}
export interface MarketData {
  getQuote(symbol: string): Quote | undefined;
}

/** Returns the fee in paise for an order. Must return a whole number >= 0. */
export type FeeModel = (side: TradeSide, grossPaise: Paise) => Paise;
export const noFees: FeeModel = () => 0;

export interface EngineOptions {
  market: MarketData;
  startingBalance?: number; // rupees
  feeModel?: FeeModel;
}

export interface OrderResult {
  trade: Trade;
  /** true when this was a repeat of an earlier order with the same clientOrderId. */
  replayed: boolean;
}

interface PositionState {
  quantity: number;
  costBasisPaise: Paise;
}

interface StoredOrder {
  symbol: string;
  side: TradeSide;
  quantity: number;
  trade: Trade;
}

function parseQuantity(input: unknown): number {
  const message = "Quantity must be a whole number greater than 0.";
  let value: number;
  if (typeof input === "number") {
    value = input;
  } else if (typeof input === "string" && /^\d+$/.test(input.trim())) {
    value = Number(input.trim());
  } else {
    throw new TradeError(message);
  }
  if (!Number.isSafeInteger(value) || value <= 0) {
    throw new TradeError(message);
  }
  if (value > MAX_ORDER_QUANTITY) {
    throw new TradeError(
      `Quantity cannot be more than ${MAX_ORDER_QUANTITY.toLocaleString("en-IN")} shares per order.`
    );
  }
  return value;
}

export class TradingEngine {
  private readonly market: MarketData;
  private readonly feeModel: FeeModel;
  private readonly startingPaise: Paise;
  private cashPaise: Paise;
  private realizedPaise: Paise = 0;
  private nextTradeId = 1;
  private readonly positions = new Map<string, PositionState>();
  private readonly trades: Trade[] = [];
  private readonly orders = new Map<string, StoredOrder>();

  constructor(options: EngineOptions) {
    this.market = options.market;
    this.feeModel = options.feeModel ?? noFees;
    this.startingPaise = rupeesToPaise(options.startingBalance ?? STARTING_BALANCE);
    if (this.startingPaise <= 0) {
      throw new RangeError("Starting balance must be greater than 0.");
    }
    this.cashPaise = this.startingPaise;
  }

  /**
   * Validate and execute one order. Safe to call twice with the same clientOrderId:
   * the second call returns the original trade and changes nothing.
   *
   * All checks and calculations happen BEFORE any state is changed, so a rejected
   * order can never leave cash, positions and history out of step.
   */
  placeOrder(
    symbolInput: unknown,
    sideInput: unknown,
    quantityInput: unknown,
    clientOrderIdInput?: unknown
  ): OrderResult {
    // ---- 1. Validate input ----
    if (typeof symbolInput !== "string" || symbolInput.trim() === "") {
      throw new TradeError("A stock symbol is required.");
    }
    const symbol = symbolInput.trim().toUpperCase();

    if (sideInput !== "BUY" && sideInput !== "SELL") {
      throw new TradeError('Side must be either "BUY" or "SELL".');
    }
    const side: TradeSide = sideInput;

    const quantity = parseQuantity(quantityInput);

    let clientOrderId: string | undefined;
    if (clientOrderIdInput !== undefined && clientOrderIdInput !== null) {
      if (typeof clientOrderIdInput !== "string" || !CLIENT_ORDER_ID_PATTERN.test(clientOrderIdInput)) {
        throw new TradeError(
          "clientOrderId must be 1-64 characters: letters, numbers, dashes or underscores."
        );
      }
      clientOrderId = clientOrderIdInput;
    }

    // ---- 2. Idempotency: have we already executed this order? ----
    if (clientOrderId !== undefined) {
      const previous = this.orders.get(clientOrderId);
      if (previous) {
        if (previous.symbol !== symbol || previous.side !== side || previous.quantity !== quantity) {
          throw new TradeError("This clientOrderId was already used for a different order.", 409);
        }
        return { trade: { ...previous.trade }, replayed: true };
      }
    }

    // ---- 3. Price ----
    const quote = this.market.getQuote(symbol);
    if (!quote) {
      throw new TradeError(`Unknown stock symbol: ${symbol}.`, 404);
    }
    const pricePaise = this.priceToPaise(symbol, quote.price);
    const grossPaise = mulPaise(pricePaise, quantity);
    const feePaise = this.feeModel(side, grossPaise);
    if (!Number.isSafeInteger(feePaise) || feePaise < 0) {
      throw new Error("Fee model must return a whole number of paise that is 0 or more.");
    }

    // ---- 4. Work out the result (no state is changed yet) ----
    let realizedDeltaPaise = 0;
    let newCashPaise: Paise;
    let newPosition: PositionState | null;

    if (side === "BUY") {
      const requiredPaise = grossPaise + feePaise;
      if (requiredPaise > this.cashPaise) {
        throw new TradeError(
          `Not enough virtual cash. This order costs ${formatPaiseINR(requiredPaise)} but you have ${formatPaiseINR(this.cashPaise)}.`
        );
      }
      const existing = this.positions.get(symbol);
      newPosition = {
        quantity: (existing?.quantity ?? 0) + quantity,
        costBasisPaise: (existing?.costBasisPaise ?? 0) + requiredPaise,
      };
      newCashPaise = this.cashPaise - requiredPaise;
    } else {
      const existing = this.positions.get(symbol);
      const owned = existing?.quantity ?? 0;
      if (!existing || quantity > owned) {
        throw new TradeError(`Not enough shares. You tried to sell ${quantity} ${symbol} but own ${owned}.`);
      }
      if (feePaise > grossPaise) {
        throw new TradeError("The fee would be larger than the sale proceeds.");
      }
      const netPaise = grossPaise - feePaise;
      const releasedPaise =
        quantity === existing.quantity
          ? existing.costBasisPaise // full sell: release everything, leave no leftover paise
          : proportionalShare(existing.costBasisPaise, quantity, existing.quantity);
      realizedDeltaPaise = netPaise - releasedPaise;
      newCashPaise = this.cashPaise + netPaise;
      newPosition =
        quantity === existing.quantity
          ? null
          : { quantity: existing.quantity - quantity, costBasisPaise: existing.costBasisPaise - releasedPaise };
    }

    // ---- 5. Apply everything together ----
    this.cashPaise = newCashPaise;
    this.realizedPaise += realizedDeltaPaise;
    if (newPosition) {
      this.positions.set(symbol, newPosition);
    } else {
      this.positions.delete(symbol);
    }

    const trade: Trade = {
      id: this.nextTradeId++,
      symbol,
      side,
      quantity,
      price: paiseToRupees(pricePaise),
      total: paiseToRupees(grossPaise),
      fee: paiseToRupees(feePaise),
      realizedPnl: paiseToRupees(realizedDeltaPaise),
      timestamp: new Date().toISOString(),
      ...(clientOrderId !== undefined ? { clientOrderId } : {}),
    };
    this.trades.push(trade);
    if (clientOrderId !== undefined) {
      this.orders.set(clientOrderId, { symbol, side, quantity, trade });
    }
    return { trade: { ...trade }, replayed: false };
  }

  getPortfolio(): PortfolioSummary {
    const holdings: Holding[] = [];
    let holdingsValuePaise = 0;
    let unrealizedPaise = 0;

    for (const [symbol, position] of this.positions) {
      const quote = this.market.getQuote(symbol);
      if (!quote) {
        // Failing loudly is better than showing totals that silently leave a stock out.
        throw new Error(`No price available for held position ${symbol}.`);
      }
      const pricePaise = this.priceToPaise(symbol, quote.price);
      const marketValuePaise = mulPaise(pricePaise, position.quantity);
      const holdingUnrealizedPaise = marketValuePaise - position.costBasisPaise;
      holdingsValuePaise += marketValuePaise;
      unrealizedPaise += holdingUnrealizedPaise;

      holdings.push({
        symbol,
        quantity: position.quantity,
        avgPrice: paiseToRupees(Math.round(position.costBasisPaise / position.quantity)),
        name: quote.name,
        currentPrice: paiseToRupees(pricePaise),
        invested: paiseToRupees(position.costBasisPaise),
        marketValue: paiseToRupees(marketValuePaise),
        unrealizedPnl: paiseToRupees(holdingUnrealizedPaise),
        unrealizedPnlPercent: percentOf(holdingUnrealizedPaise, position.costBasisPaise),
      });
    }

    holdings.sort((a, b) => a.symbol.localeCompare(b.symbol));

    const totalValuePaise = this.cashPaise + holdingsValuePaise;
    const totalPnlPaise = totalValuePaise - this.startingPaise;

    return {
      startingBalance: paiseToRupees(this.startingPaise),
      cash: paiseToRupees(this.cashPaise),
      holdingsValue: paiseToRupees(holdingsValuePaise),
      totalValue: paiseToRupees(totalValuePaise),
      totalPnl: paiseToRupees(totalPnlPaise),
      totalPnlPercent: percentOf(totalPnlPaise, this.startingPaise),
      unrealizedPnl: paiseToRupees(unrealizedPaise),
      realizedPnl: paiseToRupees(this.realizedPaise),
      holdings,
    };
  }

  /** Trade history, newest first. Returns copies so callers cannot change the history. */
  getTrades(): Trade[] {
    return this.trades.map((t) => ({ ...t })).reverse();
  }

  private priceToPaise(symbol: string, price: number): Paise {
    let paise: Paise;
    try {
      paise = rupeesToPaise(price);
    } catch {
      throw new TradeError(`No valid price is available for ${symbol} right now.`, 503);
    }
    if (paise < 1) {
      throw new TradeError(`No valid price is available for ${symbol} right now.`, 503);
    }
    return paise;
  }
}

// ---------------------------------------------------------------------------
// The engine used by the running server (mock stock prices, in-memory state).
// The route files only use the functions below, so they barely changed.
// ---------------------------------------------------------------------------

const mockMarket: MarketData = {
  getQuote(symbol: string): Quote | undefined {
    const stock = getStockDetail(symbol);
    return stock ? { name: stock.name, price: stock.price } : undefined;
  },
};

const defaultEngine = new TradingEngine({ market: mockMarket });

export function placeOrder(
  symbol: unknown,
  side: unknown,
  quantity: unknown,
  clientOrderId?: unknown
): OrderResult {
  return defaultEngine.placeOrder(symbol, side, quantity, clientOrderId);
}

/** Kept for backward compatibility: returns only the trade. */
export function executeTrade(
  symbol: unknown,
  side: unknown,
  quantity: unknown,
  clientOrderId?: unknown
): Trade {
  return defaultEngine.placeOrder(symbol, side, quantity, clientOrderId).trade;
}

export function getPortfolio(): PortfolioSummary {
  return defaultEngine.getPortfolio();
}

export function getTrades(): Trade[] {
  return defaultEngine.getTrades();
}