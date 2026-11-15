import type { Trade } from "../types";
import { formatDateTime, formatINR, formatSigned, pnlColor } from "../utils/format";
import { EmptyState } from "./Feedback";

export default function TradeHistory({ trades, limit }: { trades: Trade[]; limit?: number }) {
  if (trades.length === 0) {
    return <EmptyState title="No trades yet" hint="Trades you make will appear here." />;
  }
  const rows = limit ? trades.slice(0, limit) : trades;

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[620px]">
        <thead className="border-b border-slate-200">
          <tr>
            <th className="th">Time</th>
            <th className="th">Type</th>
            <th className="th">Stock</th>
            <th className="th text-right">Qty</th>
            <th className="th text-right">Price</th>
            <th className="th text-right">Total</th>
            <th className="th text-right">Realized P/L</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {rows.map((t) => (
            <tr key={t.id}>
              <td className="td whitespace-nowrap text-slate-500">{formatDateTime(t.timestamp)}</td>
              <td className={`td font-semibold ${t.side === "BUY" ? "text-gain" : "text-loss"}`}>{t.side}</td>
              <td className="td font-semibold">{t.symbol}</td>
              <td className="td text-right tabular-nums">{t.quantity}</td>
              <td className="td text-right tabular-nums">{formatINR(t.price)}</td>
              <td className="td text-right tabular-nums">{formatINR(t.total)}</td>
              <td className={`td text-right tabular-nums ${t.side === "SELL" ? pnlColor(t.realizedPnl) : "text-slate-400"}`}>
                {t.side === "SELL" ? formatSigned(t.realizedPnl) : "-"}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
