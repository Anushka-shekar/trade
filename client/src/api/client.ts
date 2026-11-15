import type { PortfolioSummary, Stock, StockDetail, Trade, TradeSide } from "../types";

// In development, Vite proxies "/api" to http://localhost:4000 (see vite.config.ts).
const BASE = "/api";

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  let response: Response;
  try {
    response = await fetch(BASE + path, {
      headers: { "Content-Type": "application/json" },
      ...options,
    });
  } catch {
    throw new Error("Cannot reach the server. Is the backend running on port 4000?");
  }

  // The server sends { error: "message" } for failures.
  let body: unknown = null;
  try {
    body = await response.json();
  } catch {
    // Response had no JSON body (for example the proxy could not reach the backend).
  }

  if (!response.ok) {
    const message =
      body && typeof body === "object" && "error" in body && typeof (body as { error: unknown }).error === "string"
        ? (body as { error: string }).error
        : `Request failed (status ${response.status}). Is the backend running on port 4000?`;
    throw new Error(message);
  }
  return body as T;
}

export const api = {
  getStocks: () => request<Stock[]>("/stocks"),
  getStock: (symbol: string) => request<StockDetail>(`/stocks/${encodeURIComponent(symbol)}`),
  getPortfolio: () => request<PortfolioSummary>("/portfolio"),
  getTrades: () => request<Trade[]>("/trades"),
  placeTrade: (symbol: string, side: TradeSide, quantity: number) =>
    request<Trade>("/trades", {
      method: "POST",
      body: JSON.stringify({ symbol, side, quantity }),
    }),
};
