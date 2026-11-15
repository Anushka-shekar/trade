import { useState } from "react";
import type { Stock, TradeSide } from "../types";
import { formatINR } from "../utils/format";

interface TradeFormProps {
  stock: Stock;
  cash: number;
  ownedQuantity: number;
  onTrade: (symbol: string, side: TradeSide, quantity: number) => Promise<void>;
}

export default function TradeForm({ stock, cash, ownedQuantity, onTrade }: TradeFormProps) {
  const [quantityText, setQuantityText] = useState("1");
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<{ kind: "success" | "error"; text: string } | null>(null);

  const quantity = Number(quantityText);
  const validQuantity = Number.isInteger(quantity) && quantity > 0;
  const estimate = validQuantity ? quantity * stock.price : 0;

  async function submit(side: TradeSide) {
    if (!validQuantity) {
      setMessage({ kind: "error", text: "Enter a whole number of shares greater than 0." });
      return;
    }
    setSubmitting(true);
    setMessage(null);
    try {
      await onTrade(stock.symbol, side, quantity);
      setMessage({
        kind: "success",
        text: `${side === "BUY" ? "Bought" : "Sold"} ${quantity} ${stock.symbol} at ${formatINR(stock.price)}.`,
      });
    } catch (err) {
      setMessage({ kind: "error", text: err instanceof Error ? err.message : "Trade failed." });
    } finally {
      setSubmitting(false);
    }
  }

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
          role={message.kind === "error" ? "alert" : "status"}
          className={`mt-4 rounded-md px-3 py-2 text-sm ${
            message.kind === "error" ? "bg-red-50 text-red-800" : "bg-emerald-50 text-emerald-800"
          }`}
        >
          {message.text}
        </p>
      )}
    </div>
  );
}
