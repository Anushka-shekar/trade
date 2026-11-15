import { Router } from "express";
import { getPortfolio } from "../services/tradingService";

const router = Router();

// GET /api/portfolio -> cash, holdings, profit/loss
router.get("/", (_req, res) => {
  res.json(getPortfolio());
});

export default router;
