import type { Stock } from "../types";
import { formatINR, formatPercent, pnlColor } from "../utils/format";
import { EmptyState } from "./Feedback";

interface StockTableProps {
  stocks: Stock[];
  selectedSymbol?: string | null;
  onSelect: (symbol: string) => void;
}

export default function StockTable({ stocks, selectedSymbol, onSelect }: StockTableProps) {
  if (stocks.length === 0) {
    return <EmptyState title="No stocks available" hint="The server returned an empty stock list." />;
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[420px]">
        <thead className="border-b border-slate-200">
          <tr>
            <th className="th">Symbol</th>
            <th className="th text-right">Price</th>
            <th className="th text-right">Day change</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {stocks.map((stock) => {
            const selected = stock.symbol === selectedSymbol;
            return (
              <tr
                key={stock.symbol}
                onClick={() => onSelect(stock.symbol)}
                className={`cursor-pointer hover:bg-slate-50 ${selected ? "bg-teal-50" : ""}`}
              >
                <td className="td">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onSelect(stock.symbol);
                    }}
                    className="text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-brand"
                  >
                    <span className="block font-semibold">{stock.symbol}</span>
                    <span className="block text-xs text-slate-500">{stock.name}</span>
                  </button>
                </td>
                <td className="td text-right tabular-nums">{formatINR(stock.price)}</td>
                <td className={`td text-right tabular-nums ${pnlColor(stock.changePercent)}`}>
                  {formatPercent(stock.changePercent)}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
