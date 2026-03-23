import { describe, expect, it } from "vitest";
import { chooseCorrelationWindow, favoriteLongshotBiasCorrectedProbability } from "@/lib/scoring/phase2";
import { exponentialDecay } from "@/lib/scoring/phase3";
import { computeMacroStressScore } from "@/lib/data/fred";

describe("phase2/phase3 utilities", () => {
  it("compresses correlation window in crisis z-score", () => {
    expect(chooseCorrelationWindow(0.9, 0.2, 0.2)).toBe(20);
    expect(chooseCorrelationWindow(0.25, 0.2, 0.2)).toBe(60);
  });

  it("applies confidence correction and exponential decay", () => {
    const corrected = favoriteLongshotBiasCorrectedProbability(0.9, "low");
    expect(corrected).toBeLessThan(0.9);
    expect(exponentialDecay(100, 14, 14)).toBeCloseTo(50, 2);
  });

  it("computes bounded macro stress score", () => {
    const score = computeMacroStressScore({
      cpi: 3,
      unemployment: 6.2,
      fedFundsRate: 5.5,
      tenYearYield: 5.1,
    });
    expect(score).toBeGreaterThan(60);
    expect(score).toBeLessThanOrEqual(100);
  });
});
