export type View = "dashboard" | "market" | "portfolio" | "history";

const ITEMS: { id: View; label: string }[] = [
  { id: "dashboard", label: "Dashboard" },
  { id: "market", label: "Market & Trade" },
  { id: "portfolio", label: "Portfolio" },
  { id: "history", label: "Trade history" },
];

interface SidebarProps {
  current: View;
  onChange: (view: View) => void;
}

export default function Sidebar({ current, onChange }: SidebarProps) {
  return (
    <aside className="bg-ink-900 text-white md:sticky md:top-0 md:h-screen md:w-60 md:shrink-0">
      <div className="px-4 py-4 md:px-5 md:py-6">
        <h1 className="text-lg font-bold tracking-tight">TradeLab AI</h1>
        <p className="text-xs text-slate-400">A flight simulator for traders</p>
      </div>
      <nav aria-label="Main" className="flex gap-1 overflow-x-auto px-2 pb-2 md:flex-col md:px-3">
        {ITEMS.map((item) => {
          const active = item.id === current;
          return (
            <button
              key={item.id}
              onClick={() => onChange(item.id)}
              aria-current={active ? "page" : undefined}
              className={`whitespace-nowrap rounded-md px-3 py-2 text-left text-sm font-medium transition focus:outline-none focus-visible:ring-2 focus-visible:ring-white/60 ${
                active ? "bg-brand text-white" : "text-slate-300 hover:bg-ink-700 hover:text-white"
              }`}
            >
              {item.label}
            </button>
          );
        })}
      </nav>
      <p className="hidden px-5 pt-6 text-xs leading-relaxed text-slate-400 md:block">
        Practice mode. Prices are mock data and trades use virtual money.
      </p>
    </aside>
  );
}
