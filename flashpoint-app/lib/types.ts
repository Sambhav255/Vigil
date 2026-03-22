export type Severity = "critical" | "high" | "medium" | "low";
export type ThreatDirection = "bearish" | "bullish" | "neutral";
export type ConfidenceTier = "high" | "medium" | "low";

export type Threat = {
  id: number;
  title: string;
  category: string;
  severity: Severity;
  assets: string[];
  direction: ThreatDirection;
  probability: number;
  probSource: "Polymarket" | "Kalshi";
  probDelta: number;
  confidence: ConfidenceTier;
  volume: number;
  cascadeEta: string;
  momentum: "escalating" | "peaking" | "fading";
  summary: string;
  sector: string;
  verified: boolean;
  sourceCount: number;
  probHistory: number[];
  compositeScore?: number;
};

export type SourceState = "live" | "stale" | "delayed" | "offline";

export type SourceSnapshot = {
  lastUpdatedMs: number;
  ok: boolean;
};

export type SourceHealth = {
  state: SourceState;
  label: string;
  lastUpdatedMs: number;
};

export type SectorData = {
  name: string;
  score: number;
  count: number;
};

export type ForceData = {
  name: string;
  weight: number;
  score: number;
};
