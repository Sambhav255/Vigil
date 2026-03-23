import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/data/sources", () => ({
  getDashboardData: vi.fn(async () => ({
    gprIndex: 100,
    tickers: [],
    sectors: [],
    forces: [
      { name: "Geopolitical", weight: 0.35, score: 50 },
      { name: "Macro", weight: 0.25, score: 50 },
      { name: "Sentiment", weight: 0.2, score: 50 },
      { name: "Supply Chain", weight: 0.12, score: 50 },
      { name: "Climate", weight: 0.08, score: 50 },
    ],
    sourceSnapshots: Object.fromEntries(
      ["polymarket","kalshi","gdelt","alphaVantage","coinGecko","usgs","nasaEonet","fred","gprIndex","geminiFlash"]
        .map(k => [k, { lastUpdatedMs: Date.now(), ok: true }])
    ),
    threats: [
      {
        id: 1, title: "Fed rate decision imminent",
        category: "Macroeconomic", severity: "high" as const,
        createdAt: Date.now(), assets: ["SPY"], direction: "bearish" as const,
        probability: 0.5, probSource: "Kalshi" as const, probDelta: 0,
        confidence: "high" as const, volume: 50000, cascadeEta: "1 week",
        momentum: "escalating" as const, summary: "x", sector: "Finance",
        verified: true, sourceCount: 2, probHistory: [0.5],
      },
      {
        id: 2, title: "Hurricane approaching Gulf Coast refineries",
        category: "Climate", severity: "medium" as const,
        createdAt: Date.now(), assets: ["CL"], direction: "bearish" as const,
        probability: 0.8, probSource: "Kalshi" as const, probDelta: 0,
        confidence: "high" as const, volume: 100000, cascadeEta: "2 days",
        momentum: "escalating" as const, summary: "y", sector: "Energy",
        verified: true, sourceCount: 3, probHistory: [0.8],
      },
      {
        id: 3, title: "Bitcoin ETF outflows signal bearish trend",
        category: "Sentiment", severity: "low" as const,
        createdAt: Date.now(), assets: ["BTC"], direction: "bearish" as const,
        probability: 0.3, probSource: "Polymarket" as const, probDelta: 0,
        confidence: "low" as const, volume: 5000, cascadeEta: "3 days",
        momentum: "fading" as const, summary: "z", sector: "Crypto",
        verified: false, sourceCount: 1, probHistory: [0.3],
      },
    ],
  })),
}));

describe("pipeline deduplication", () => {
  it("does not merge dissimilar threats", async () => {
    const { buildDashboardSnapshot } = await import("@/lib/pipeline");
    const snapshot = await buildDashboardSnapshot();
    expect(snapshot.threats.length).toBe(3);
  });

  it("global risk index is between 0 and 100", async () => {
    const { buildDashboardSnapshot } = await import("@/lib/pipeline");
    const snapshot = await buildDashboardSnapshot();
    expect(snapshot.globalRisk).toBeGreaterThan(0);
    expect(snapshot.globalRisk).toBeLessThanOrEqual(100);
  });

  it("all threats have compositeScore defined", async () => {
    const { buildDashboardSnapshot } = await import("@/lib/pipeline");
    const snapshot = await buildDashboardSnapshot();
    for (const t of snapshot.threats) {
      expect(t.compositeScore).toBeDefined();
      expect(t.compositeScore).toBeGreaterThanOrEqual(0);
    }
  });
});
