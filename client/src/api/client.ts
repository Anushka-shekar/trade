import type { PortfolioSummary, Stock, StockDetail, Trade, TradeSide } from "../types";

// In development, Vite proxies "/api" to http://localhost:4000 (see vite.config.ts).
const BASE = "/api";

export class ApiError extends Error {
  /** HTTP status code, or null when no response arrived at all (network failure). */
  readonly status: number | null;

  constructor(message: string, status: number | null) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }

  /**
   * True when we cannot tell whether the server carried out the request
   * (no response, or a server-side 5xx error). A clean 4xx answer means it did NOT.
   */
  get outcomeUnknown(): boolean {
    return this.status === null || this.status >= 500;
  }
}

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  let response: Response;
  try {
    response = await fetch(BASE + path, {
      headers: { "Content-Type": "application/json" },
      ...options,
    });
  } catch {
    throw new ApiError("Cannot reach the server. Is the backend running on port 4000?", null);
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
        : response.status >= 500
          ? `Request failed (status ${response.status}). Is the backend running on port 4000?`
          : `Request failed (status ${response.status}).`;
    throw new ApiError(message, response.status);
  }
  return body as T;
}

export const api = {
  getStocks: () => request<Stock[]>("/stocks"),
  getStock: (symbol: string) => request<StockDetail>(`/stocks/${encodeURIComponent(symbol)}`),
  getPortfolio: () => request<PortfolioSummary>("/portfolio"),
  getTrades: () => request<Trade[]>("/trades"),
  // clientOrderId makes retries safe: the server ignores a repeat of an order it already executed.
  placeTrade: (symbol: string, side: TradeSide, quantity: number, clientOrderId: string) =>
    request<Trade>("/trades", {
      method: "POST",
      body: JSON.stringify({ symbol, side, quantity, clientOrderId }),
    }),
};