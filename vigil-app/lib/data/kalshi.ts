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

function extractTitle(m: unknown): string | null {
  const market = m as Record<string, unknown>;
  if (typeof market?.title === "string" && market.title) return market.title;
  if (typeof market?.subtitle === "string" && market.subtitle) return market.subtitle;
  if (typeof market?.event_ticker === "string" && market.event_ticker) return market.event_ticker;
  if (typeof market?.ticker === "string" && market.ticker) return market.ticker;
  return null;
}

function extractProbability(m: unknown): number | null {
  const market = m as Record<string, unknown>;
  // For binary markets, Kalshi exposes yes-price as last_price_dollars (0..1).
  const p = parseNum(market?.last_price_dollars);
  if (p == null) return null;
  return clampProbability(p);
}

function extractVolume(m: unknown): number | null {
  const market = m as Record<string, unknown>;
  return (
    parseNum(market?.volume_24h_fp) ??
    parseNum(market?.liquidity_dollars) ??
    parseNum(market?.notional_value_dollars) ??
    null
  );
}

export async function fetchKalshiThreatUpdates(baseThreats: Threat[]): Promise<{
  ok: boolean;
  updates: ThreatUpdate[];
}> {
  const url = "https://api.elections.kalshi.com/trade-api/v2/markets";
  const json = await safeFetchJson<{ markets?: unknown[] }>(url);
  const markets = json?.markets;
  if (!markets || !Array.isArray(markets)) return { ok: false, updates: [] };

  const threatsById = new Map<number, Threat>(baseThreats.map((t) => [t.id, t]));
  const updatesById = new Map<number, ThreatUpdate>();

  for (const market of markets) {
    if (!market || typeof market !== "object") continue;
    const m = market as Record<string, unknown>;
    const title = extractTitle(m);
    if (!title) continue;
    if (!isMacroLike(title)) continue;

    const prob = extractProbability(m);
    if (prob == null) continue;
    const volume = extractVolume(m) ?? 0;

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

