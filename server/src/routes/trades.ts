import { Router } from "express";
import { executeTrade, getTrades, TradeError } from "../services/tradingService";

const router = Router();

// GET /api/trades -> trade history (newest first)
router.get("/", (_req, res) => {
  res.json(getTrades());
});

// POST /api/trades  body: { symbol, side: "BUY" | "SELL", quantity }
router.post("/", (req, res) => {
  try {
    const { symbol, side, quantity } = req.body ?? {};
    const trade = executeTrade(symbol, side, quantity);
    res.status(201).json(trade);
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
