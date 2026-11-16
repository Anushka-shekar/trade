import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { MarketData, TradeError, TradingEngine } from "./tradingService";

// A fake market whose prices (in rupees) the test controls.
function setup(prices: Record<string, number>, startingBalance?: number) {
  const current = { ...prices };
  const market: MarketData = {
    getQuote: (symbol) =>
      Object.prototype.hasOwnProperty.call(current, symbol) ? { name: symbol, price: current[symbol] } : undefined,
  };
  return { engine: new TradingEngine({ market, startingBalance }), setPrice: (s: string, p: number) => (current[s] = p) };
}

const paise = (rupees: number) => Math.round(rupees * 100);

function assertTradeError(fn: () => unknown, status: number, pattern: RegExp) {
  assert.throws(fn, (err: unknown) => {
    assert.ok(err instanceof TradeError);
    assert.equal(err.status, status);
    assert.match(err.message, pattern);
    return true;
  });
}

// total P&L must equal realized + unrealized, and net worth must equal cash + holdings (all in paise)
function assertReconciles(engine: TradingEngine) {
  const p = engine.getPortfolio();
  assert.equal(paise(p.totalValue), paise(p.cash) + paise(p.holdingsValue));
  assert.equal(paise(p.totalPnl), paise(p.totalValue) - paise(p.startingBalance));
  assert.equal(paise(p.totalPnl), paise(p.realizedPnl) + paise(p.unrealizedPnl));
}

describe("worked example from the requirements", () => {
  it("buy 10 @ 100, price rises to 120, sell 4 @ 120", () => {
    const { engine, setPrice } = setup({ AAA: 100 });

    engine.placeOrder("AAA", "BUY", 10);
    let p = engine.getPortfolio();
    assert.equal(p.cash, 999000);
    assert.equal(p.holdingsValue, 1000);
    assert.equal(p.totalValue, 1000000); // a BUY neither creates nor destroys money

    setPrice("AAA", 120);
    p = engine.getPortfolio();
    assert.equal(p.holdingsValue, 1200);
    assert.equal(p.unrealizedPnl, 200);
    assert.equal(p.realizedPnl, 0);

    const { trade } = engine.placeOrder("AAA", "SELL", 4);
    assert.equal(trade.total, 480);
    assert.equal(trade.realizedPnl, 80);

    p = engine.getPortfolio();
    assert.equal(p.cash, 999480);
    assert.equal(p.holdings[0].quantity, 6);
    assert.equal(p.realizedPnl, 80);
    assert.equal(p.unrealizedPnl, 120);
    assert.equal(p.totalPnl, 200);
    assertReconciles(engine);
  });
});

describe("cost basis and closing positions", () => {
  it("averages several purchases at different prices", () => {
    const { engine, setPrice } = setup({ AAA: 100 });
    engine.placeOrder("AAA", "BUY", 10); // 1000
    setPrice("AAA", 130);
    engine.placeOrder("AAA", "BUY", 20); // 2600
    const h = engine.getPortfolio().holdings[0];
    assert.equal(h.quantity, 30);
    assert.equal(h.invested, 3600);
    assert.equal(h.avgPrice, 120);
    assertReconciles(engine);
  });

  it("selling everything closes the position and leaves no stray paise", () => {
    const { engine, setPrice } = setup({ AAA: 100 });
    engine.placeOrder("AAA", "BUY", 1);
    setPrice("AAA", 100.01);
    engine.placeOrder("AAA", "BUY", 2);
    engine.placeOrder("AAA", "SELL", 1);
    engine.placeOrder("AAA", "SELL", 1);
    engine.placeOrder("AAA", "SELL", 1);
    const p = engine.getPortfolio();
    assert.equal(p.holdings.length, 0);
    assert.equal(p.unrealizedPnl, 0);
    assert.equal(p.realizedPnl, 0.01);
    assert.equal(p.totalPnl, 0.01);
    assertReconciles(engine);
  });

  it("uses exact paise: 3 x 100.10 is exactly 300.30", () => {
    const { engine } = setup({ AAA: 100.1 });
    const { trade } = engine.placeOrder("AAA", "BUY", 3);
    assert.equal(trade.total, 300.3);
    assert.equal(engine.getPortfolio().cash, 999699.7);
  });
});

describe("validation", () => {
  it("rejects bad quantities, sides and symbols without changing anything", () => {
    const { engine } = setup({ AAA: 100 });
    for (const q of [0, -1, 1.5, NaN, "abc", "", null, undefined, true]) {
      assertTradeError(() => engine.placeOrder("AAA", "BUY", q), 400, /whole number/);
    }
    assertTradeError(() => engine.placeOrder("AAA", "HOLD", 1), 400, /BUY.*SELL/);
    assertTradeError(() => engine.placeOrder("NOPE", "BUY", 1), 404, /Unknown stock symbol/);
    assert.equal(engine.getTrades().length, 0);
    assert.equal(engine.getPortfolio().cash, 1000000);
  });

  it("rejects a BUY you cannot afford and a SELL of shares you do not own", () => {
    const { engine } = setup({ AAA: 100 }, 1000);
    assertTradeError(() => engine.placeOrder("AAA", "BUY", 11), 400, /Not enough virtual cash/);
    assertTradeError(() => engine.placeOrder("AAA", "SELL", 1), 400, /Not enough shares/);
    engine.placeOrder("AAA", "BUY", 10); // exactly all the cash is allowed
    assertTradeError(() => engine.placeOrder("AAA", "SELL", 11), 400, /Not enough shares.*own 10/);
    assert.equal(engine.getTrades().length, 1);
  });
});

describe("duplicate orders", () => {
  it("the same clientOrderId runs only once and returns the original trade", () => {
    const { engine } = setup({ AAA: 100 });
    const first = engine.placeOrder("AAA", "BUY", 10, "order-1");
    const again = engine.placeOrder("AAA", "BUY", 10, "order-1");
    assert.equal(first.replayed, false);
    assert.equal(again.replayed, true);
    assert.deepEqual(again.trade, first.trade);
    assert.equal(engine.getTrades().length, 1);
    assert.equal(engine.getPortfolio().cash, 999000);
  });

  it("reusing an id for a different order is refused", () => {
    const { engine } = setup({ AAA: 100 });
    engine.placeOrder("AAA", "BUY", 10, "order-1");
    assertTradeError(() => engine.placeOrder("AAA", "BUY", 11, "order-1"), 409, /different order/);
    assert.equal(engine.getTrades().length, 1);
  });
});

describe("randomized reconciliation", () => {
  it("stays consistent over 1500 random orders while prices move", () => {
    let seed = 12345;
    const random = () => ((seed = (seed * 1664525 + 1013904223) % 4294967296) / 4294967296);
    const symbols = ["AAA", "BBB", "CCC"];
    const prices: Record<string, number> = { AAA: 2850.5, BBB: 431.27, CCC: 99.99 };
    const { engine, setPrice } = setup(prices);
    let executed = 0;
    for (let i = 0; i < 1500; i++) {
      const s = symbols[Math.floor(random() * symbols.length)];
      prices[s] = Math.max(1, Math.round(prices[s] * (1 + (random() - 0.5) * 0.1) * 100) / 100);
      setPrice(s, prices[s]);
      try {
        engine.placeOrder(s, random() < 0.5 ? "BUY" : "SELL", 1 + Math.floor(random() * 50));
        executed++;
      } catch (err) {
        if (!(err instanceof TradeError)) throw err;
      }
      assertReconciles(engine);
    }
    assert.ok(executed > 200);
  });
});