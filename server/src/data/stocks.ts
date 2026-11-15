import { PricePoint, Stock, StockDetail } from "../types";

/**
 * MOCK DATA ONLY. These are NOT real market prices.
 * Price history is generated once at startup using a seeded pseudo-random
 * generator, so the same price moves appear every time the server starts.
 */

const HISTORY_DAYS = 30;

interface StockSeed {
  symbol: string;
  name: string;
  basePrice: number;
  volatility: number; // max daily move, as a fraction (0.02 = 2%)
  seed: number;
}

const SEEDS: StockSeed[] = [
  { symbol: "RELIANCE", name: "Reliance Industries", basePrice: 2850, volatility: 0.02, seed: 11 },
  { symbol: "TCS", name: "Tata Consultancy Services", basePrice: 3920, volatility: 0.015, seed: 23 },
  { symbol: "INFY", name: "Infosys", basePrice: 1640, volatility: 0.018, seed: 37 },
  { symbol: "HDFCBANK", name: "HDFC Bank", basePrice: 1580, volatility: 0.014, seed: 41 },
  { symbol: "ICICIBANK", name: "ICICI Bank", basePrice: 1125, volatility: 0.016, seed: 53 },
  { symbol: "ITC", name: "ITC Limited", basePrice: 435, volatility: 0.012, seed: 67 },
];

// Small deterministic random number generator (mulberry32).
function makeRandom(seed: number): () => number {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

function generateHistory(seed: StockSeed): PricePoint[] {
  const random = makeRandom(seed.seed);
  const points: PricePoint[] = [];
  let price = seed.basePrice;
  const today = new Date();

  for (let i = HISTORY_DAYS - 1; i >= 0; i--) {
    const date = new Date(today);
    date.setDate(today.getDate() - i);
    // Random move between -volatility and +volatility
    const move = (random() * 2 - 1) * seed.volatility;
    price = Math.max(1, price * (1 + move));
    points.push({ date: date.toISOString().slice(0, 10), close: round2(price) });
  }
  return points;
}

const stockDetails: StockDetail[] = SEEDS.map((seed) => {
  const history = generateHistory(seed);
  const price = history[history.length - 1].close;
  const previousClose = history[history.length - 2].close;
  const change = round2(price - previousClose);
  const changePercent = round2((change / previousClose) * 100);
  return {
    symbol: seed.symbol,
    name: seed.name,
    price,
    previousClose,
    change,
    changePercent,
    history,
  };
});

export function getAllStocks(): Stock[] {
  // List view: leave out the (larger) history array.
  return stockDetails.map((s) => ({
    symbol: s.symbol,
    name: s.name,
    price: s.price,
    previousClose: s.previousClose,
    change: s.change,
    changePercent: s.changePercent,
  }));
}

export function getStockDetail(symbol: string): StockDetail | undefined {
  return stockDetails.find((s) => s.symbol === symbol.toUpperCase());
}

export function getPrice(symbol: string): number | undefined {
  return getStockDetail(symbol)?.price;
}
