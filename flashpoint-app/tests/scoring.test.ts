import { describe, expect, it } from "vitest";
import {
  applySingleSourceSeverityCap,
  classifyConfidenceTier,
  computeCompositeThreatScore,
  computeGlobalRiskIndex,
  normalizeGdeltVolume,
} from "@/lib/scoring/core";

describe("scoring core", () => {
  it("normalizes gdelt regional volume against global flow", () => {
    expect(normalizeGdeltVolume(120, 1200, 100)).toBeCloseTo(10, 3);
  });

  it("maps confidence tiers from prediction market volume", () => {
    expect(classifyConfidenceTier(150_000)).toBe("high");
    expect(classifyConfidenceTier(50_000)).toBe("medium");
    expect(classifyConfidenceTier(5_000)).toBe("low");
  });

  it("caps single-source events at high severity", () => {
    expect(applySingleSourceSeverityCap("critical", 1)).toBe("high");
    expect(applySingleSourceSeverityCap("high", 1)).toBe("high");
  });

  it("computes bounded global risk index using sigmoid", () => {
    const value = computeGlobalRiskIndex(
      { geopolitical: 80, macroeconomic: 65, sentiment: 55, supplyChain: 40, climate: 30 },
      187
    );
    expect(value).toBeGreaterThan(0);
    expect(value).toBeLessThanOrEqual(100);
  });

  it("computes composite threat score", () => {
    const score = computeCompositeThreatScore(0.8, 0.62, 1.1);
    expect(score).toBeCloseTo(54.56, 2);
  });
});
