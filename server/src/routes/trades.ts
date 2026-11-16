import { Router } from "express";
import { getTrades, placeOrder, TradeError } from "../services/tradingService";

const router = Router();

// GET /api/trades -> trade history (newest first)
router.get("/", (_req, res) => {
  res.json(getTrades());
});

// POST /api/trades  body: { symbol, side: "BUY" | "SELL", quantity, clientOrderId? }
// clientOrderId makes the request safe to retry: sending the same id again returns the
// original trade (status 200) instead of executing a second one. A new trade returns 201.
router.post("/", (req, res) => {
  try {
    const { symbol, side, quantity, clientOrderId } = req.body ?? {};
    const { trade, replayed } = placeOrder(symbol, side, quantity, clientOrderId);
    if (replayed) {
      res.setHeader("Idempotent-Replayed", "true");
    }
    res.status(replayed ? 200 : 201).json(trade);
  } catch (err) {
    if (err instanceof TradeError) {
      res.status(err.status).json({ error: err.message });
      return;
    }
    console.error(err);
    res.status(500).json({ error: "Something went wrong while executing the trade." });
  }
});

export default router;