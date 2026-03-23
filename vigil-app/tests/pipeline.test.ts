import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/data/sources", () => ({
  getDashboardData: vi.fn(async () => ({
    gprIndex: 140,
    tickers: [],
    sectors: [],
    forces: [
      { name: "Geopolitical", weight: 0.35, score: 70 },
      { name: "Macro", weight: 0.25, score: 60 },
      { name: "Sentiment", weight: 0.2, score: 45 },
      { name: "Supply Chain", weight: 0.12, score: 50 },
      { name: "Climate", weight: 0.08, score: 40 },
    ],
    sourceSnapshots: {
      polymarket: { lastUpdatedMs: Date.now(), ok: true },
      kalshi: { lastUpdatedMs: Date.now(), ok: true },
      gdelt: { lastUpdatedMs: Date.now(), ok: true },
      alphaVantage: { lastUpdatedMs: Date.now(), ok: true },
      coinGecko: { lastUpdatedMs: Date.now(), ok: true },
      usgs: { lastUpdatedMs: Date.now(), ok: true },
      nasaEonet: { lastUpdatedMs: Date.now(), ok: true },
      fred: { lastUpdatedMs: Date.now(), ok: true },
      gprIndex: { lastUpdatedMs: Date.now(), ok: true },
      geminiFlash: { lastUpdatedMs: Date.now(), ok: true },
    },
    threats: [
      {
        id: 1,
        title: "Taiwan Strait military escalation risk",
        category: "Geopolitical",
        severity: "high",
        createdAt: Date.now() - 2 * 60 * 60 * 1000,
        assets: ["NVDA"],
        direction: "bearish",
        probability: 0.5,
        probSource: "Polymarket",
        probDelta: 0.02,
        confidence: "high",
        volume: 100000,
        cascadeEta: "1-3 days",
        momentum: "escalating",
        summary: "x",
        sector: "Technology",
        verified: false,
        sourceCount: 1,
        probHistory: [0.4, 0.5],
      },
      {
        id: 2,
        title: "Taiwan Strait escalation military conflict",
        category: "Geopolitical",
        severity: "critical",
        createdAt: Date.now() - 90 * 60 * 1000,
        assets: ["TSM"],
        direction: "bearish",
        probability: 0.6,
        probSource: "Kalshi",
        probDelta: 0.03,
        confidence: "high",
        volume: 120000,
        cascadeEta: "1-3 days",
        momentum: "escalating",
        summary: "y",
        sector: "Technology",
        verified: false,
        sourceCount: 1,
        probHistory: [0.55, 0.6],
      },
    ],
  })),
}));

describe("pipeline", () => {
  it("deduplicates similar threats and marks as corroborated", async () => {
    const { buildDashboardSnapshot } = await import("@/lib/pipeline");
    const snapshot = await buildDashboardSnapshot();

    expect(snapshot.threats.length).toBe(1);
    expect(snapshot.threats[0].verified).toBe(true);
    expect(snapshot.threats[0].sourceCount).toBe(2);
    expect(snapshot.threats[0].severity).toBe("critical");
  });
});
