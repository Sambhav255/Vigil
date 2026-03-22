// Phase 3 hooks allow incremental rollout of advanced models.
export type AdvancedCorrelationMode = "rolling" | "regime-switching" | "dcc-garch";

export function selectCorrelationMode(hasTraction: boolean): AdvancedCorrelationMode {
  return hasTraction ? "regime-switching" : "rolling";
}

export function exponentialDecay(score: number, elapsedHours: number, halfLifeHours: number) {
  if (halfLifeHours <= 0) return score;
  return score * Math.pow(0.5, elapsedHours / halfLifeHours);
}

export function powerLawDecay(score: number, elapsedHours: number, alpha: number) {
  if (alpha <= 0) return score;
  return score / Math.pow(1 + elapsedHours, alpha);
}
