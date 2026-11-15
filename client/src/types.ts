// These types mirror server/src/types.ts. Keep them in sync when you change the API.
export type TradeSide = "BUY" | "SELL";

export interface PricePoint {
  date: string;
  close: number;
}

export interface Stock {
  symbol: string;
  name: string;
  price: number;
  previousClose: number;
  change: number;
  changePercent: number;
}

export interface StockDetail extends Stock {
  history: PricePoint[];
}

export interface Holding {
  symbol: string;
  name: string;
  quantity: number;
  avgPrice: number;
  currentPrice: number;
  invested: number;
  marketValue: number;
  unrealizedPnl: number;
  unrealizedPnlPercent: number;
}

export interface Trade {
  id: number;
  symbol: string;
  side: TradeSide;
  quantity: number;
  price: number;
  total: number;
  realizedPnl: number;
  timestamp: string;
}

export interface PortfolioSummary {
  startingBalance: number;
  cash: number;
  holdingsValue: number;
  totalValue: number;
  totalPnl: number;
  totalPnlPercent: number;
  unrealizedPnl: number;
  realizedPnl: number;
  holdings: Holding[];
}
