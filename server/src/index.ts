import cors from "cors";
import express from "express";
import portfolioRoutes from "./routes/portfolio";
import stockRoutes from "./routes/stocks";
import tradeRoutes from "./routes/trades";

const app = express();
const PORT = Number(process.env.PORT) || 4000;

// Allow the Vite dev server to call this API directly if needed.
app.use(cors({ origin: ["http://localhost:5173", "http://127.0.0.1:5173"] }));
app.use(express.json());

app.get("/api/health", (_req, res) => {
  res.json({ status: "ok", note: "Mock data, in-memory storage. Resets on restart." });
});

app.use("/api/stocks", stockRoutes);
app.use("/api/portfolio", portfolioRoutes);
app.use("/api/trades", tradeRoutes);

// Unknown API route
app.use("/api", (_req, res) => {
  res.status(404).json({ error: "API route not found." });
});

app.listen(PORT, () => {
  console.log(`TradeLab AI server running at http://localhost:${PORT}`);
  console.log("Using MOCK data and IN-MEMORY storage (resets on restart).");
});
