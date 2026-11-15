export type TradeSide = "BUY" | "SELL";

export interface PricePoint {
  date: string; // YYYY-MM-DD
  close: number;
}

export interface Stock {
  symbol: string;
  name: string;
  price: number;
  previousClose: number;
  change: number; // absolute change vs previous close
  changePercent: number; // daily % change
}

export interface StockDetail extends Stock {
  history: PricePoint[];
}

export interface Position {
  symbol: string;
  quantity: number;
  avgPrice: number;
}

export interface Holding extends Position {
  name: string;
  currentPrice: number;
  marketValue: number;
  invested: number;
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
  realizedPnl: number; // 0 for BUY trades
  timestamp: string; // ISO string
}

export interface PortfolioSummary {
  startingBalance: number;
  cash: number;
  holdingsValue: number;
  totalValue: number; // cash + holdingsValue
  totalPnl: number; // totalValue - startingBalance (realized + unrealized)
  totalPnlPercent: number;
  unrealizedPnl: number;
  realizedPnl: number;
  holdings: Holding[];
}
