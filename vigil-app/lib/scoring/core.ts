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

function normalizeForceKey(key: string): string {
  // Normalize "Supply Chain" => "supplychain", "Macro" => "macro", etc.
  return key.toLowerCase().replace(/[\s\-_]/g, "");
}

export function computeGlobalRiskIndex(
  categories: Record<string, number>,
  gprIndex: number
) {
  const gprFactor = 1 + Math.max(0, (gprIndex - 100) / 500);

  // Canonicalize inputs to the keys used by CATEGORY_WEIGHTS.
  const byCanonicalKey: Partial<Record<keyof typeof CATEGORY_WEIGHTS, number>> = {};
  for (const [rawKey, value] of Object.entries(categories)) {
    const normalized = normalizeForceKey(rawKey);
    if (normalized === "geopolitical") byCanonicalKey.geopolitical = value;
    else if (normalized === "macro") byCanonicalKey.macroeconomic = value;
    else if (normalized === "macroeconomic") byCanonicalKey.macroeconomic = value;
    else if (normalized === "sentiment") byCanonicalKey.sentiment = value;
    else if (normalized === "supplychain") byCanonicalKey.supplyChain = value;
    else if (normalized === "climate") byCanonicalKey.climate = value;
  }

  const geo = byCanonicalKey.geopolitical ?? 0;
  const macro = byCanonicalKey.macroeconomic ?? 0;
  const sentiment = byCanonicalKey.sentiment ?? 0;
  const supplyChain = byCanonicalKey.supplyChain ?? 0;
  const climate = byCanonicalKey.climate ?? 0;

  const weighted =
    geo * CATEGORY_WEIGHTS.geopolitical * gprFactor +
    macro * CATEGORY_WEIGHTS.macroeconomic +
    sentiment * CATEGORY_WEIGHTS.sentiment +
    supplyChain * CATEGORY_WEIGHTS.supplyChain +
    climate * CATEGORY_WEIGHTS.climate;

  // Rescale so typical force scores map to a meaningful 1–95 index (sigmoid sat near zero for common inputs).
  const raw = Math.min(95, weighted * 1.4);
  return Math.max(1, Math.round(raw));
}

export function computeCompositeThreatScore(sensitivity: number, probability: number, gprAdjustmentFactor: number) {
  return sensitivity * probability * gprAdjustmentFactor * 100;
}
