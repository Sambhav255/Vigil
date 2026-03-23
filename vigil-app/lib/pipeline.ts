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
import { exponentialDecay } from "@/lib/scoring/phase3";
import { FORCES, SECTORS, SOURCE_STALE_AFTER_MS } from "@/lib/config/constants";

const sensitivityBySector: Record<string, number> = {
  Technology: 0.8,
  Finance: 0.7,
  Crypto: 0.9,
  Energy: 0.75,
  Commodities: 0.65,
  Defense: 0.7,
};

const severityRank: Record<"low" | "medium" | "high" | "critical", number> = {
  low: 1,
  medium: 2,
  high: 3,
  critical: 4,
};

function tokenizeTitle(input: string): string[] {
  return input
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 2);
}

function jaccardSimilarity(a: string, b: string): number {
  const setA = new Set(tokenizeTitle(a));
  const setB = new Set(tokenizeTitle(b));
  if (setA.size === 0 || setB.size === 0) return 0;
  let intersection = 0;
  for (const t of setA) if (setB.has(t)) intersection++;
  const union = setA.size + setB.size - intersection;
  return union > 0 ? intersection / union : 0;
}

function shouldMergeTitles(a: string, b: string): boolean {
  const setA = new Set(tokenizeTitle(a));
  const setB = new Set(tokenizeTitle(b));
  let shared = 0;
  for (const t of setA) if (setB.has(t)) shared++;
  return shared > 3 || jaccardSimilarity(a, b) > 0.4;
}

export async function buildDashboardSnapshot() {
  const raw = await getDashboardData();
  const now = Date.now();
  const gprAdjustmentFactor = 1 + Math.max(0, (raw.gprIndex - 100) / 700);

  type ScoredThreat = (typeof raw.threats)[number] & {
    confidence: ReturnType<typeof classifyConfidenceTier>;
    probability: number;
    severity: ReturnType<typeof applySingleSourceSeverityCap>;
    compositeScore: number;
  };

  const mergeThreats = (a: ScoredThreat, b: ScoredThreat): ScoredThreat => {
    const weightA = Math.max(1, a.volume);
    const weightB = Math.max(1, b.volume);
    const total = weightA + weightB;

    const mergedSeverity = severityRank[a.severity] >= severityRank[b.severity] ? a.severity : b.severity;
    const mergedProbability = (a.probability * weightA + b.probability * weightB) / total;
    const mergedComposite = (a.compositeScore * weightA + b.compositeScore * weightB) / total;

    return {
      ...a,
      title: a.title.length >= b.title.length ? a.title : b.title,
      createdAt: Math.min(a.createdAt, b.createdAt),
      severity: mergedSeverity,
      assets: Array.from(new Set([...a.assets, ...b.assets])),
      probability: mergedProbability,
      probDelta: (a.probDelta + b.probDelta) / 2,
      confidence: a.confidence === "high" || b.confidence === "high" ? "high" : a.confidence === "medium" || b.confidence === "medium" ? "medium" : "low",
      volume: a.volume + b.volume,
      verified: true,
      sourceCount: a.sourceCount + b.sourceCount,
      probHistory: [...a.probHistory, ...b.probHistory].slice(-7),
      compositeScore: mergedComposite,
    };
  };

  const dedupeThreats = (input: ScoredThreat[]): ScoredThreat[] => {
    const out: ScoredThreat[] = [];
    for (const threat of input) {
      const idx = out.findIndex((existing) => shouldMergeTitles(existing.title, threat.title));
      if (idx === -1) {
        out.push(threat);
      } else {
        out[idx] = mergeThreats(out[idx], threat);
      }
    }
    return out;
  };

  const scoreThreats = (sensitivityMultiplier: number, halfLifeMultiplier: number): ScoredThreat[] => {
    return raw.threats.map((threat) => {
      const confidence = classifyConfidenceTier(threat.volume);
      const probability = favoriteLongshotBiasCorrectedProbability(threat.probability, confidence);
      const severity = applySingleSourceSeverityCap(threat.severity, threat.sourceCount);

      const baseSensitivity = sensitivityBySector[threat.sector] ?? 0.6;
      const sensitivity = baseSensitivity * sensitivityMultiplier;
      const baseCompositeScore = computeCompositeThreatScore(sensitivity, probability, gprAdjustmentFactor);

      // Phase 3.1 — apply asymmetric exponential decay based on age.
      const threatAgeHours = Math.max(0, (now - (threat.createdAt ?? now)) / (1000 * 60 * 60));
      const baseHalfLifeHours = threat.direction === "bearish" ? 21 : 14; // negative events decay slower
      const halfLifeHours = baseHalfLifeHours * halfLifeMultiplier;
      const decayedCompositeScore = exponentialDecay(baseCompositeScore, threatAgeHours, halfLifeHours);

      return { ...threat, confidence, probability, severity, compositeScore: decayedCompositeScore };
    });
  };

  const usgs = raw.sourceSnapshots.usgs;
  const nasaEonet = raw.sourceSnapshots.nasaEonet;
  const usgsActive = !!usgs.ok && now - usgs.lastUpdatedMs <= SOURCE_STALE_AFTER_MS;
  const eonetActive = !!nasaEonet.ok && now - nasaEonet.lastUpdatedMs <= SOURCE_STALE_AFTER_MS;
  const naturalEventsActive = usgsActive || eonetActive;

  const rawForcesByName = Object.fromEntries(raw.forces.map((f) => [f.name, f.score])) as Record<string, number>;
  const fallbackByForceName = (forceName: string): number => {
    return FORCES.find((f) => f.name === forceName)?.score ?? 0;
  };

  const computeDerived = (scoredThreats: ScoredThreat[]) => {
    // Phase 1.2 — dynamic sector scores computed from scored threats.
    const sectorMap = new Map<string, { totalScore: number; count: number }>();
    for (const t of scoredThreats) {
      if (!t.sector) continue;
      const existing = sectorMap.get(t.sector) ?? { totalScore: 0, count: 0 };
      existing.totalScore += t.compositeScore ?? 0;
      existing.count += 1;
      sectorMap.set(t.sector, existing);
    }
    const computedSectors = SECTORS.map((s) => {
      const data = sectorMap.get(s.name);
      return {
        name: s.name,
        score: data && data.count > 0 ? Math.round(data.totalScore / data.count) : 0,
        count: data?.count ?? 0,
      };
    });

    // Phase 1.3 — derive force scores from actual threats with fallbacks.
    const avgCompositeByCategory = (categoryName: string): number | null => {
      const filtered = scoredThreats.filter((t) => t.category === categoryName);
      if (filtered.length === 0) return null;
      const sum = filtered.reduce((acc, t) => acc + (t.compositeScore ?? 0), 0);
      return sum / filtered.length;
    };

    const threatGeopolitical = avgCompositeByCategory("Geopolitical");
    const threatSentiment = avgCompositeByCategory("Sentiment");
    const threatSupplyChain = avgCompositeByCategory("Supply Chain");
    const threatClimate = avgCompositeByCategory("Climate");
    const threatMacro = avgCompositeByCategory("Macroeconomic");

    const fredMacroBaseline = rawForcesByName["Macro"] ?? fallbackByForceName("Macro");

    // Blend macro: keep FRED baseline, blend with threat-category macro signal.
    const blendedMacro =
      threatMacro === null ? fredMacroBaseline : 0.65 * fredMacroBaseline + 0.35 * threatMacro;

    const derivedForces = [
      {
        name: "Geopolitical",
        weight: FORCES.find((f) => f.name === "Geopolitical")?.weight ?? 0.35,
        score:
          threatGeopolitical === null ? fallbackByForceName("Geopolitical") : Math.round(threatGeopolitical),
      },
      {
        name: "Macro",
        weight: FORCES.find((f) => f.name === "Macro")?.weight ?? 0.25,
        score: Math.round(Math.max(0, Math.min(100, blendedMacro))),
      },
      {
        name: "Sentiment",
        weight: FORCES.find((f) => f.name === "Sentiment")?.weight ?? 0.2,
        score: threatSentiment === null ? fallbackByForceName("Sentiment") : Math.round(threatSentiment),
      },
      {
        name: "Supply Chain",
        weight: FORCES.find((f) => f.name === "Supply Chain")?.weight ?? 0.12,
        score:
          threatSupplyChain === null ? fallbackByForceName("Supply Chain") : Math.round(threatSupplyChain),
      },
      {
        name: "Climate",
        weight: FORCES.find((f) => f.name === "Climate")?.weight ?? 0.08,
        score: (() => {
          const base = threatClimate === null ? fallbackByForceName("Climate") : Math.round(threatClimate);
          return naturalEventsActive ? Math.min(100, base + 15) : base;
        })(),
      },
    ];

    return {
      computedSectors,
      derivedForces,
      globalRisk: computeGlobalRiskIndex(
        Object.fromEntries(derivedForces.map((f) => [f.name, f.score])) as Record<string, number>,
        raw.gprIndex
      ),
    };
  };

  // Phase 3.2 (simulated regime switching): crisis mode if enough escalating threats
  // and the current global risk estimate is high.
  let threats = dedupeThreats(scoreThreats(1, 1));
  let derived = computeDerived(threats);
  const escalatingCount = threats.filter((t) => t.momentum === "escalating").length;
  const crisisMode = escalatingCount > 3 && derived.globalRisk > 70;
  if (crisisMode) {
    threats = dedupeThreats(scoreThreats(1.15, 0.6));
    derived = computeDerived(threats);
  }

  // File-based logging is local-dev only; Convex is the deployed destination.
  const convexConfigured = !!process.env.NEXT_PUBLIC_CONVEX_URL;
  if (!convexConfigured) {
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
  }

  return {
    globalRisk: derived.globalRisk,
    gprIndex: raw.gprIndex,
    tickers: raw.tickers,
    threats,
    sectors: derived.computedSectors,
    forces: derived.derivedForces,
    sourceHealth: evaluateSourceHealth(raw.sourceSnapshots, now),
  };
}
