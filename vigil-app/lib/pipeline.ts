import { getDashboardData } from "@/lib/data/sources";
import { evaluateSourceHealth } from "@/lib/degradation/sourceHealth";
import { logHitRateEvent } from "@/lib/logging/hitRate";
import {
  applySingleSourceSeverityCap,
  classifyConfidenceTier,
  computeCompositeThreatScore,
  computeGlobalRiskIndex,
} from "@/lib/scoring/core";
import { favoriteLongshotBiasCorrectedProbability } from "@/lib/scoring/phase2";

const sensitivityBySector: Record<string, number> = {
  Technology: 0.8,
  Finance: 0.7,
  Crypto: 0.9,
  Energy: 0.75,
  Commodities: 0.65,
  Defense: 0.7,
};

export async function buildDashboardSnapshot() {
  const raw = await getDashboardData();
  const now = Date.now();
  const gprAdjustmentFactor = 1 + Math.max(0, (raw.gprIndex - 100) / 700);

  const threats = raw.threats.map((threat) => {
    const confidence = classifyConfidenceTier(threat.volume);
    const probability = favoriteLongshotBiasCorrectedProbability(threat.probability, confidence);
    const severity = applySingleSourceSeverityCap(threat.severity, threat.sourceCount);
    const sensitivity = sensitivityBySector[threat.sector] ?? 0.6;
    const compositeScore = computeCompositeThreatScore(sensitivity, probability, gprAdjustmentFactor);
    return { ...threat, confidence, probability, severity, compositeScore };
  });

  await Promise.all(
    threats
      .filter((t) => t.compositeScore > 60)
      .flatMap((t) =>
        t.assets.slice(0, 1).map((ticker) =>
          logHitRateEvent({
            id: `${t.id}-${ticker}-${now}`,
            ticker,
            direction: t.direction,
            score: t.compositeScore ?? 0,
            priceAtAlert: 0,
            createdAt: now,
          })
        )
      )
  );

  return {
    globalRisk: computeGlobalRiskIndex(
      { geopolitical: 72, macroeconomic: 61, sentiment: 48, supplyChain: 55, climate: 47 },
      raw.gprIndex
    ),
    gprIndex: raw.gprIndex,
    tickers: raw.tickers,
    threats,
    sectors: raw.sectors,
    forces: raw.forces,
    sourceHealth: evaluateSourceHealth(raw.sourceSnapshots, now),
  };
}
