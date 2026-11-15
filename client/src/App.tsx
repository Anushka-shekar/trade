import { useCallback, useEffect, useState } from "react";
import { api } from "./api/client";
import { EmptyState, ErrorMessage, Loading } from "./components/Feedback";
import HoldingsTable from "./components/HoldingsTable";
import PriceChart from "./components/PriceChart";
import Sidebar, { type View } from "./components/Sidebar";
import StatCard from "./components/StatCard";
import StockTable from "./components/StockTable";
import TradeForm from "./components/TradeForm";
import TradeHistory from "./components/TradeHistory";
import type { PortfolioSummary, Stock, StockDetail, Trade, TradeSide } from "./types";
import { formatINR, formatPercent, formatSigned, pnlColor } from "./utils/format";

export default function App() {
  const [view, setView] = useState<View>("dashboard");
  const [stocks, setStocks] = useState<Stock[]>([]);
  const [portfolio, setPortfolio] = useState<PortfolioSummary | null>(null);
  const [trades, setTrades] = useState<Trade[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [selectedSymbol, setSelectedSymbol] = useState<string | null>(null);
  const [detail, setDetail] = useState<StockDetail | null>(null);
  const [detailError, setDetailError] = useState<string | null>(null);

  const loadAll = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [s, p, t] = await Promise.all([api.getStocks(), api.getPortfolio(), api.getTrades()]);
      setStocks(s);
      setPortfolio(p);
      setTrades(t);
      setSelectedSymbol((current) => current ?? (s.length > 0 ? s[0].symbol : null));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load data.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  // Load price history whenever the selected stock changes.
  useEffect(() => {
    if (!selectedSymbol) return;
    let cancelled = false;
    setDetail(null);
    setDetailError(null);
    api
      .getStock(selectedSymbol)
      .then((d) => {
        if (!cancelled) setDetail(d);
      })
      .catch((err) => {
        if (!cancelled) setDetailError(err instanceof Error ? err.message : "Failed to load stock.");
      });
    return () => {
      cancelled = true;
    };
  }, [selectedSymbol]);

  // Throws on failure so TradeForm can show the server's error message.
  async function handleTrade(symbol: string, side: TradeSide, quantity: number) {
    await api.placeTrade(symbol, side, quantity);
    const [p, t] = await Promise.all([api.getPortfolio(), api.getTrades()]);
    setPortfolio(p);
    setTrades(t);
  }

  function openStock(symbol: string) {
    setSelectedSymbol(symbol);
    setView("market");
  }

  const selectedStock = stocks.find((s) => s.symbol === selectedSymbol) ?? null;
  const ownedQuantity = portfolio?.holdings.find((h) => h.symbol === selectedSymbol)?.quantity ?? 0;

  function renderContent() {
    if (loading) return <Loading label="Loading market data..." />;
    if (error || !portfolio) return <ErrorMessage message={error ?? "No data received."} onRetry={loadAll} />;

    switch (view) {
      case "dashboard":
        return (
          <div className="space-y-6">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
              <StatCard label="Virtual cash" value={formatINR(portfolio.cash)} />
              <StatCard label="Portfolio value" value={formatINR(portfolio.holdingsValue)} sub="Stocks at current mock prices" valueClassName="text-ink-900" />
              <StatCard
                label="Total profit / loss"
                value={formatSigned(portfolio.totalPnl)}
                sub={formatPercent(portfolio.totalPnlPercent)}
                valueClassName={pnlColor(portfolio.totalPnl)}
              />
              <StatCard label="Net worth" value={formatINR(portfolio.totalValue)} sub={`Started with ${formatINR(portfolio.startingBalance)}`} valueClassName="text-ink-900" />
            </div>
            <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
              <section className="card">
                <h2 className="card-title">Stocks</h2>
                <StockTable stocks={stocks} onSelect={openStock} />
              </section>
              <section className="card">
                <h2 className="card-title">Recent trades</h2>
                <TradeHistory trades={trades} limit={5} />
              </section>
            </div>
          </div>
        );

      case "market":
        return (
          <div className="grid grid-cols-1 gap-6 xl:grid-cols-5">
            <section className="card xl:col-span-2">
              <h2 className="card-title">Stocks</h2>
              <StockTable stocks={stocks} selectedSymbol={selectedSymbol} onSelect={setSelectedSymbol} />
            </section>
            <div className="space-y-6 xl:col-span-3">
              {!selectedStock ? (
                <EmptyState title="Select a stock" hint="Pick a stock from the list to see its price history." />
              ) : (
                <>
                  <section className="card">
                    <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
                      <div>
                        <h2 className="text-lg font-semibold">{selectedStock.symbol}</h2>
                        <p className="text-sm text-slate-500">{selectedStock.name} · last 30 days (mock data)</p>
                      </div>
                      <p className="text-right tabular-nums">
                        <span className="block text-xl font-semibold">{formatINR(selectedStock.price)}</span>
                        <span className={`block text-sm ${pnlColor(selectedStock.changePercent)}`}>
                          {formatPercent(selectedStock.changePercent)} today
                        </span>
                      </p>
                    </div>
                    {detailError ? (
                      <ErrorMessage message={detailError} />
                    ) : !detail ? (
                      <Loading label="Loading price history..." />
                    ) : (
                      <PriceChart history={detail.history} />
                    )}
                  </section>
                  <section className="card">
                    <h2 className="card-title">Place a practice trade</h2>
                    <TradeForm
                      key={selectedStock.symbol}
                      stock={selectedStock}
                      cash={portfolio.cash}
                      ownedQuantity={ownedQuantity}
                      onTrade={handleTrade}
                    />
                  </section>
                </>
              )}
            </div>
          </div>
        );

      case "portfolio":
        return (
          <section className="card">
            <h2 className="card-title">Holdings</h2>
            <HoldingsTable holdings={portfolio.holdings} />
            {portfolio.holdings.length > 0 && (
              <p className="mt-4 text-sm text-slate-600">
                Unrealized P/L:{" "}
                <span className={`font-semibold tabular-nums ${pnlColor(portfolio.unrealizedPnl)}`}>
                  {formatSigned(portfolio.unrealizedPnl)}
                </span>
                {" · "}Realized P/L:{" "}
                <span className={`font-semibold tabular-nums ${pnlColor(portfolio.realizedPnl)}`}>
                  {formatSigned(portfolio.realizedPnl)}
                </span>
              </p>
            )}
          </section>
        );

      case "history":
        return (
          <section className="card">
            <h2 className="card-title">Trade history</h2>
            <TradeHistory trades={trades} />
          </section>
        );
    }
  }

  const titles: Record<View, string> = {
    dashboard: "Dashboard",
    market: "Market & Trade",
    portfolio: "Portfolio",
    history: "Trade history",
  };

  return (
    <div className="min-h-screen md:flex">
      <Sidebar current={view} onChange={setView} />
      <main className="min-w-0 flex-1 p-4 sm:p-6">
        <header className="mb-5 flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-2xl font-bold tracking-tight">{titles[view]}</h2>
          <span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-medium text-amber-900">
            Mock prices · virtual money · resets on server restart
          </span>
        </header>
        {renderContent()}
      </main>
    </div>
  );
}
