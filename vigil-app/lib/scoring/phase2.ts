// Phase 2 hardening utilities.
export function favoriteLongshotBiasCorrectedProbability(probability: number, confidence: "high" | "medium" | "low") {
  if (confidence === "high") return probability;
  const baseRate = 0.5;
  const compression = confidence === "medium" ? 0.9 : 0.8;
  return baseRate + (probability - baseRate) * compression;
}

export function chooseCorrelationWindow(
  trailingFiveDay: number,
  rollingSixtyDayMean: number,
  rollingSixtyDayStdDev: number
) {
  if (rollingSixtyDayStdDev <= 0) return 60;
  const z = (trailingFiveDay - rollingSixtyDayMean) / rollingSixtyDayStdDev;
  return z > 2 ? 20 : 60;
}

export function shouldTriggerNovelEventAI(keywordScore: number) {
  return keywordScore < 0.05;
}
