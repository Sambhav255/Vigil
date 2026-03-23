import type { Threat } from "@/lib/types";
import { logSourceFailure } from "@/lib/logging/sourceLogger";

type ThreatUpdate = {
  id: number;
  probability?: number;
  probDelta?: number;
  volume?: number;
  probSource?: "Polymarket" | "Kalshi";
  probHistory?: number[];
};

const FETCH_TIMEOUT_MS = 8_000;

const prevProbByThreatId = new Map<number, number>();
const historyByThreatId = new Map<number, number[]>();

function tokenize(s: string): string[] {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/g)
    .map((x) => x.trim())
    .filter(Boolean)
    .filter((w) => w.length > 2);
}

function keywordScore(a: string, b: string) {
  const ta = new Set(tokenize(a));
  const tb = new Set(tokenize(b));
  if (ta.size === 0 || tb.size === 0) return 0;
  let inter = 0;
  for (const x of ta) if (tb.has(x)) inter++;
  const union = ta.size + tb.size - inter;
  return union ? inter / union : 0;
}

function parseNum(v: unknown): number | null {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string") {
    const n = parseFloat(v.replace(/,/g, ""));
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

function clampProbability(p: number) {
  if (!Number.isFinite(p)) return null;
  if (p > 1.01) p = p / 100;
  return Math.max(0, Math.min(1, p));
}

async function safeFetchJson<T>(url: string): Promise<T | null> {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
    try {
      const res = await fetch(url, { cache: "no-store", signal: controller.signal });
      if (!res.ok) return null;
      return (await res.json()) as T;
    } finally {
      clearTimeout(timer);
    }
  } catch {
    logSourceFailure("kalshi", "safeFetchJson failed", { url });
    return null;
  }
}

function isMacroLike(title: string) {
  return /(federal reserve|rate|cpi|inflation|jobs|unemployment|gdp|bond|yield|treasury)/i.test(title);
}

function extractTitle(m: any): string | null {
  if (typeof m?.title === "string" && m.title) return m.title;
  if (typeof m?.subtitle === "string" && m.subtitle) return m.subtitle;
  if (typeof m?.event_ticker === "string" && m.event_ticker) return m.event_ticker;
  if (typeof m?.ticker === "string" && m.ticker) return m.ticker;
  return null;
}

function extractProbability(m: any): number | null {
  // For binary markets, Kalshi exposes yes-price as last_price_dollars (0..1).
  const p = parseNum(m?.last_price_dollars);
  if (p == null) return null;
  return clampProbability(p);
}

function extractVolume(m: any): number | null {
  return (
    parseNum(m?.volume_24h_fp) ??
    parseNum(m?.liquidity_dollars) ??
    parseNum(m?.notional_value_dollars) ??
    null
  );
}

export async function fetchKalshiThreatUpdates(baseThreats: Threat[]): Promise<{
  ok: boolean;
  updates: ThreatUpdate[];
}> {
  const url = "https://api.elections.kalshi.com/trade-api/v2/markets";
  const json = await safeFetchJson<any>(url);
  const markets = json?.markets;
  if (!markets || !Array.isArray(markets)) return { ok: false, updates: [] };

  const threatsById = new Map<number, Threat>(baseThreats.map((t) => [t.id, t]));
  const updatesById = new Map<number, ThreatUpdate>();

  for (const market of markets) {
    const title = extractTitle(market);
    if (!title) continue;
    if (!isMacroLike(title)) continue;

    const prob = extractProbability(market);
    if (prob == null) continue;
    const volume = extractVolume(market) ?? 0;

    let best: { id: number; score: number } | null = null;
    for (const t of baseThreats) {
      const score = keywordScore(title, t.title);
      if (!best || score > best.score) best = { id: t.id, score };
    }
    if (!best || best.score < 0.12) continue;

    const threat = threatsById.get(best.id);
    if (!threat) continue;

    const prevProb = prevProbByThreatId.get(threat.id) ?? threat.probability;
    const probDelta = prob - prevProb;

    const prevHistory = historyByThreatId.get(threat.id) ?? threat.probHistory ?? [];
    const nextHistory = [...prevHistory, prob].slice(-7);

    prevProbByThreatId.set(threat.id, prob);
    historyByThreatId.set(threat.id, nextHistory);

    updatesById.set(threat.id, {
      id: threat.id,
      probability: prob,
      probDelta,
      volume,
      probSource: "Kalshi",
      probHistory: nextHistory,
    });
  }

  return { ok: true, updates: Array.from(updatesById.values()) };
}

