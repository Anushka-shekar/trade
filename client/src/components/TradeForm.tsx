import { useRef, useState } from "react";
import { ApiError } from "../api/client";
import type { Stock, TradeSide } from "../types";
import { formatINR } from "../utils/format";

/** What the parent reports after the trade itself succeeded. */
export interface TradeOutcome {
  /** false if the trade worked but reloading the portfolio/history afterwards failed. */
  refreshed: boolean;
}

interface TradeFormProps {
  stock: Stock;
  cash: number;
  ownedQuantity: number;
  onTrade: (symbol: string, side: TradeSide, quantity: number, clientOrderId: string) => Promise<TradeOutcome>;
}

function newOrderId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`;
}

export default function TradeForm({ stock, cash, ownedQuantity, onTrade }: TradeFormProps) {
  const [quantityText, setQuantityText] = useState("1");
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<{ kind: "success" | "error" | "warning"; text: string } | null>(null);

  // Blocks a second click while a request is still running (state updates are not instant).
  const inFlight = useRef(false);
  // The order ID for the current attempt. It is only cleared once we know the outcome, so a
  // retry of an unfinished request sends the SAME ID and the server will not run it twice.
  const pendingOrder = useRef<{ key: string; id: string } | null>(null);

  const quantity = Number(quantityText);
  const validQuantity = Number.isInteger(quantity) && quantity > 0;
  const estimate = validQuantity ? quantity * stock.price : 0;

  async function submit(side: TradeSide) {
    if (inFlight.current) return;
    if (!validQuantity) {
      setMessage({ kind: "error", text: "Enter a whole number of shares greater than 0." });
      return;
    }

    // One order ID per user submission. Same stock + side + quantity as an attempt whose outcome
    // is still unknown means "retry that attempt", so it keeps its ID. Anything else is a new order.
    const key = `${stock.symbol}|${side}|${quantity}`;
    if (!pendingOrder.current || pendingOrder.current.key !== key) {
      pendingOrder.current = { key, id: newOrderId() };
    }
    const orderId = pendingOrder.current.id;

    inFlight.current = true;
    setSubmitting(true);
    setMessage(null);
    try {
      const outcome = await onTrade(stock.symbol, side, quantity, orderId);
      pendingOrder.current = null; // finished: the next click is a brand-new order
      const done = `${side === "BUY" ? "Bought" : "Sold"} ${quantity} ${stock.symbol} at ${formatINR(stock.price)}.`;
      if (outcome.refreshed) {
        setMessage({ kind: "success", text: done });
      } else {
        setMessage({
          kind: "warning",
          text: `${done} The trade went through, but the screen could not refresh. It was not repeated. Reload the page to see your latest balance.`,
        });
      }
    } catch (err) {
      const text = err instanceof Error ? err.message : "Trade failed.";
      if (err instanceof ApiError && err.outcomeUnknown) {
        // Keep pendingOrder: clicking the same button again is a safe retry.
        setMessage({
          kind: "error",
          text: `${text} The trade may or may not have gone through. Click the same button again to retry safely. It will not be executed twice.`,
        });
      } else {
        pendingOrder.current = null; // the server clearly refused it; a new click is a new order
        setMessage({ kind: "error", text });
      }
    } finally {
      inFlight.current = false;
      setSubmitting(false);
    }
  }

  const messageStyle = {
    error: "bg-red-50 text-red-800",
    success: "bg-emerald-50 text-emerald-800",
    warning: "bg-amber-50 text-amber-900",
  } as const;

  return (
    <div>
      <dl className="mb-4 grid grid-cols-2 gap-3 text-sm">
        <div>
          <dt className="text-slate-500">Available cash</dt>
          <dd className="font-semibold tabular-nums">{formatINR(cash)}</dd>
        </div>
        <div>
          <dt className="text-slate-500">You own</dt>
          <dd className="font-semibold tabular-nums">
            {ownedQuantity} {stock.symbol}
          </dd>
        </div>
      </dl>

      <label htmlFor="quantity" className="block text-sm font-medium text-slate-700">
        Quantity (shares)
      </label>
      <input
        id="quantity"
        type="number"
        min={1}
        step={1}
        inputMode="numeric"
        value={quantityText}
        onChange={(e) => setQuantityText(e.target.value)}
        className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm tabular-nums focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/30"
      />
      <p className="mt-2 text-sm text-slate-500">
        Estimated value at {formatINR(stock.price)}: <span className="font-semibold text-ink-900">{formatINR(estimate)}</span>
      </p>

      <div className="mt-4 grid grid-cols-2 gap-3">
        <button
          onClick={() => submit("BUY")}
          disabled={submitting}
          className="btn bg-gain hover:brightness-90 focus-visible:ring-gain"
        >
          Buy
        </button>
        <button
          onClick={() => submit("SELL")}
          disabled={submitting}
          className="btn bg-loss hover:brightness-90 focus-visible:ring-loss"
        >
          Sell
        </button>
      </div>

      {message && (
        <p
          role={message.kind === "success" ? "status" : "alert"}
          className={`mt-4 rounded-md px-3 py-2 text-sm ${messageStyle[message.kind]}`}
        >
          {message.text}
        </p>
      )}
    </div>
  );
}