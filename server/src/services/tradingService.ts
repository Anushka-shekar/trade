import { getPrice, getStockDetail } from "../data/stocks";
import { Holding, PortfolioSummary, Position, Trade, TradeSide } from "../types";

/**
 * Trading logic + IN-MEMORY state.
 * All of this resets whenever the server restarts.
 * Later you can replace the Map/array below with PostgreSQL + Prisma calls.
 */

export const STARTING_BALANCE = 1_000_000; // ₹10,00,000

export class TradeError extends Error {
  status: number;
  constructor(message: string, status = 400) {
    super(message);
    this.status = status;
  }
}

let cash = STARTING_BALANCE;
let realizedPnl = 0;
let nextTradeId = 1;
const positions = new Map<string, Position>();
const trades: Trade[] = [];

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

function inr(n: number): string {
  return "₹" + n.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export function executeTrade(symbolInput: unknown, sideInput: unknown, quantityInput: unknown): Trade {
  // ---- 1. Validate input ----
  if (typeof symbolInput !== "string" || symbolInput.trim() === "") {
    throw new TradeError("A stock symbol is required.");
  }
  const symbol = symbolInput.trim().toUpperCase();

  if (sideInput !== "BUY" && sideInput !== "SELL") {
    throw new TradeError('Side must be either "BUY" or "SELL".');
  }
  const side: TradeSide = sideInput;

  const quantity = Number(quantityInput);
  if (!Number.isInteger(quantity) || quantity <= 0) {
    throw new TradeError("Quantity must be a whole number greater than 0.");
  }

  const price = getPrice(symbol);
  if (price === undefined) {
    throw new TradeError(`Unknown stock symbol: ${symbol}.`, 404);
  }

  const total = round2(price * quantity);
  let tradePnl = 0;

  // ---- 2. Apply the trade (cash and positions always change together) ----
  if (side === "BUY") {
    if (total > cash) {
      throw new TradeError(
        `Not enough virtual cash. This order costs ${inr(total)} but you have ${inr(cash)}.`
      );
    }
    const existing = positions.get(symbol);
    if (existing) {
      const newQuantity = existing.quantity + quantity;
      // Weighted average purchase price
      existing.avgPrice = round2((existing.avgPrice * existing.quantity + total) / newQuantity);
      existing.quantity = newQuantity;
    } else {
      positions.set(symbol, { symbol, quantity, avgPrice: price });
    }
    cash = round2(cash - total);
  } else {
    const existing = positions.get(symbol);
    const owned = existing ? existing.quantity : 0;
    if (!existing || quantity > owned) {
      throw new TradeError(`Not enough shares. You tried to sell ${quantity} ${symbol} but own ${owned}.`);
    }
    tradePnl = round2((price - existing.avgPrice) * quantity);
    realizedPnl = round2(realizedPnl + tradePnl);
    existing.quantity -= quantity;
    if (existing.quantity === 0) {
      positions.delete(symbol);
    }
    cash = round2(cash + total);
  }

  // ---- 3. Record the trade ----
  const trade: Trade = {
    id: nextTradeId++,
    symbol,
    side,
    quantity,
    price,
    total,
    realizedPnl: tradePnl,
    timestamp: new Date().toISOString(),
  };
  trades.push(trade);
  return trade;
}

export function getPortfolio(): PortfolioSummary {
  const holdings: Holding[] = [];

  for (const position of positions.values()) {
    const stock = getStockDetail(position.symbol);
    if (!stock) continue; // cannot happen with the fixed mock stock list
    const invested = round2(position.avgPrice * position.quantity);
    const marketValue = round2(stock.price * position.quantity);
    const unrealizedPnl = round2(marketValue - invested);
    holdings.push({
      ...position,
      name: stock.name,
      currentPrice: stock.price,
      invested,
      marketValue,
      unrealizedPnl,
      unrealizedPnlPercent: invested > 0 ? round2((unrealizedPnl / invested) * 100) : 0,
    });
  }

  holdings.sort((a, b) => a.symbol.localeCompare(b.symbol));

  const holdingsValue = round2(holdings.reduce((sum, h) => sum + h.marketValue, 0));
  const unrealizedPnl = round2(holdings.reduce((sum, h) => sum + h.unrealizedPnl, 0));
  const totalValue = round2(cash + holdingsValue);
  const totalPnl = round2(totalValue - STARTING_BALANCE);

  return {
    startingBalance: STARTING_BALANCE,
    cash,
    holdingsValue,
    totalValue,
    totalPnl,
    totalPnlPercent: round2((totalPnl / STARTING_BALANCE) * 100),
    unrealizedPnl,
    realizedPnl,
    holdings,
  };
}

export function getTrades(): Trade[] {
  // Newest first
  return [...trades].reverse();
}
