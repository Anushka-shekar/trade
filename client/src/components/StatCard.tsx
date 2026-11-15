interface StatCardProps {
  label: string;
  value: string;
  sub?: string;
  valueClassName?: string;
}

export default function StatCard({ label, value, sub, valueClassName = "text-ink-900" }: StatCardProps) {
  return (
    <div className="card">
      <p className="text-sm text-slate-500">{label}</p>
      <p className={`mt-1 text-xl font-semibold tabular-nums sm:text-2xl ${valueClassName}`}>{value}</p>
      {sub && <p className={`mt-1 text-sm tabular-nums ${valueClassName}`}>{sub}</p>}
    </div>
  );
}
