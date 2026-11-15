import type { Holding } from "../types";
import { formatINR, formatPercent, formatSigned, pnlColor } from "../utils/format";
import { EmptyState } from "./Feedback";

export default function HoldingsTable({ holdings }: { holdings: Holding[] }) {
  if (holdings.length === 0) {
    return <EmptyState title="You don't own any stocks yet" hint="Open Market & Trade and buy your first shares." />;
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[640px]">
        <thead className="border-b border-slate-200">
          <tr>
            <th className="th">Stock</th>
            <th className="th text-right">Qty</th>
            <th className="th text-right">Avg. price</th>
            <th className="th text-right">Current price</th>
            <th className="th text-right">Unrealized P/L</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {holdings.map((h) => (
            <tr key={h.symbol}>
              <td className="td">
                <span className="block font-semibold">{h.symbol}</span>
                <span className="block text-xs text-slate-500">{h.name}</span>
              </td>
              <td className="td text-right tabular-nums">{h.quantity}</td>
              <td className="td text-right tabular-nums">{formatINR(h.avgPrice)}</td>
              <td className="td text-right tabular-nums">{formatINR(h.currentPrice)}</td>
              <td className={`td text-right tabular-nums ${pnlColor(h.unrealizedPnl)}`}>
                {formatSigned(h.unrealizedPnl)}
                <span className="block text-xs">{formatPercent(h.unrealizedPnlPercent)}</span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
