import { Router } from "express";
import { getAllStocks, getStockDetail } from "../data/stocks";

const router = Router();

// GET /api/stocks -> list of stocks
router.get("/", (_req, res) => {
  res.json(getAllStocks());
});

// GET /api/stocks/:symbol -> one stock with price history
router.get("/:symbol", (req, res) => {
  const stock = getStockDetail(req.params.symbol);
  if (!stock) {
    res.status(404).json({ error: `Unknown stock symbol: ${req.params.symbol}.` });
    return;
  }
  res.json(stock);
});

export default router;
