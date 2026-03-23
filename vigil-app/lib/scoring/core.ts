import { CATEGORY_WEIGHTS } from "@/lib/config/constants";
import type { ConfidenceTier, Severity } from "@/lib/types";

export function normalizeGdeltVolume(regionArticles: number, globalArticles: number, normalizationConstant: number) {
  if (!globalArticles) return 0;
  return (regionArticles / globalArticles) * normalizationConstant;
}

export function classifyConfidenceTier(volume: number): ConfidenceTier {
  if (volume > 100_000) return "high";
  if (volume >= 10_000) return "medium";
  return "low";
}

export function applySingleSourceSeverityCap(severity: Severity, sourceCount: number): Severity {
  if (sourceCount <= 1 && severity === "critical") return "high";
  return severity;
}

export function computeGlobalRiskIndex(
  categories: {
    geopolitical: number;
    macroeconomic: number;
    sentiment: number;
    supplyChain: number;
    climate: number;
  },
  gprIndex: number
) {
  const gprFactor = 1 + Math.max(0, (gprIndex - 100) / 500);
  const weighted =
    categories.geopolitical * CATEGORY_WEIGHTS.geopolitical * gprFactor +
    categories.macroeconomic * CATEGORY_WEIGHTS.macroeconomic +
    categories.sentiment * CATEGORY_WEIGHTS.sentiment +
    categories.supplyChain * CATEGORY_WEIGHTS.supplyChain +
    categories.climate * CATEGORY_WEIGHTS.climate;
  return 100 / (1 + Math.exp(-(weighted - 50) / 10));
}

export function computeCompositeThreatScore(sensitivity: number, probability: number, gprAdjustmentFactor: number) {
  return sensitivity * probability * gprAdjustmentFactor * 100;
}
