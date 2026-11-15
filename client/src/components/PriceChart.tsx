import type { PricePoint } from "../types";
import { formatINR } from "../utils/format";
import { EmptyState } from "./Feedback";

const WIDTH = 640;
const HEIGHT = 260;
const PAD = { top: 16, right: 16, bottom: 28, left: 72 };

export default function PriceChart({ history }: { history: PricePoint[] }) {
  if (history.length < 2) {
    return <EmptyState title="Not enough price history to draw a chart" />;
  }

  const closes = history.map((p) => p.close);
  const rawMin = Math.min(...closes);
  const rawMax = Math.max(...closes);
  const padding = (rawMax - rawMin) * 0.1 || 1;
  const min = rawMin - padding;
  const max = rawMax + padding;

  const innerW = WIDTH - PAD.left - PAD.right;
  const innerH = HEIGHT - PAD.top - PAD.bottom;
  const x = (i: number) => PAD.left + (i / (history.length - 1)) * innerW;
  const y = (v: number) => PAD.top + (1 - (v - min) / (max - min)) * innerH;

  const linePath = history.map((p, i) => `${i === 0 ? "M" : "L"}${x(i).toFixed(1)},${y(p.close).toFixed(1)}`).join(" ");
  const areaPath = `${linePath} L${x(history.length - 1).toFixed(1)},${PAD.top + innerH} L${x(0).toFixed(1)},${PAD.top + innerH} Z`;

  const rising = closes[closes.length - 1] >= closes[0];
  const color = rising ? "#0a8f5b" : "#c93c37";
  const ticks = [0, 1, 2, 3].map((n) => min + ((max - min) * n) / 3);

  return (
    <svg
      viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
      className="h-auto w-full"
      role="img"
      aria-label={`Price chart, ${history.length} days, from ${formatINR(closes[0])} to ${formatINR(closes[closes.length - 1])}`}
    >
      {ticks.map((t) => (
        <g key={t}>
          <line x1={PAD.left} x2={WIDTH - PAD.right} y1={y(t)} y2={y(t)} stroke="#e2e8f0" strokeWidth={1} />
          <text x={PAD.left - 8} y={y(t) + 4} textAnchor="end" fontSize={11} fill="#64748b">
            {Math.round(t).toLocaleString("en-IN")}
          </text>
        </g>
      ))}
      <path d={areaPath} fill={color} opacity={0.08} />
      <path d={linePath} fill="none" stroke={color} strokeWidth={2} strokeLinejoin="round" />
      {history.map((p, i) => (
        <circle key={p.date} cx={x(i)} cy={y(p.close)} r={i === history.length - 1 ? 4 : 6} fill={color} opacity={i === history.length - 1 ? 1 : 0}>
          <title>{`${p.date}: ${formatINR(p.close)}`}</title>
        </circle>
      ))}
      <text x={PAD.left} y={HEIGHT - 8} fontSize={11} fill="#64748b">
        {history[0].date}
      </text>
      <text x={WIDTH - PAD.right} y={HEIGHT - 8} textAnchor="end" fontSize={11} fill="#64748b">
        {history[history.length - 1].date}
      </text>
    </svg>
  );
}
