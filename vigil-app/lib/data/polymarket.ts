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
  // Some providers return 0..100.
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
    logSourceFailure("polymarket", "safeFetchJson failed", { url });
    return null;
  }
}

function extractEventTitle(ev: unknown): string | null {
  const e = ev as Record<string, unknown>;
  return (
    (typeof e?.title === "string" && e.title) ||
    (typeof e?.question === "string" && e.question) ||
    (typeof e?.slug === "string" && e.slug) ||
    null
  );
}

function extractYesProbability(ev: unknown): number | null {
  const e = ev as Record<string, unknown>;
  const op = e?.outcomePrices ?? e?.outcome_prices;
  const prices: number[] = [];
  if (op && typeof op === "object" && !Array.isArray(op)) {
    for (const [k, v] of Object.entries(op as Record<string, unknown>)) {
      const n = parseNum(v);
      if (n == null) continue;
      // Prefer "yes/true".
      if (/yes|true|up/i.test(k)) return clampProbability(n);
      prices.push(n);
    }
  }
  if (Array.isArray(op)) {
    // Try {name, price} shapes.
    for (const item of op) {
      const it = item as Record<string, unknown>;
      const name = String(it?.name ?? it?.outcome ?? "");
      const n = parseNum(it?.price ?? it?.p ?? it?.value);
      if (n == null) continue;
      if (/yes|true|up/i.test(name)) return clampProbability(n);
      prices.push(n);
    }
  }

  if (prices.length) {
    // Heuristic: return the max probability-like value.
    const max = Math.max(...prices);
    return clampProbability(max);
  }

  return null;
}

function extractVolume(ev: unknown): number | null {
  const e = ev as Record<string, unknown>;
  return (
    parseNum(e?.volume) ??
    parseNum(e?.totalVolume) ??
    parseNum(e?.volume24h) ??
    parseNum(e?.volume_24h) ??
    null
  );
}

export async function fetchPolymarketThreatUpdates(baseThreats: Threat[]): Promise<{
  ok: boolean;
  updates: ThreatUpdate[];
}> {
  const url = "https://gamma-api.polymarket.com/events?limit=5";
  const json = await safeFetchJson<unknown[]>(url);
  if (!json || !Array.isArray(json)) return { ok: false, updates: [] };

  const threatsById = new Map<number, Threat>(baseThreats.map((t) => [t.id, t]));

  const updatesById = new Map<number, ThreatUpdate>();

  for (const raw of json) {
    if (!raw || typeof raw !== "object") continue;
    const ev = raw as Record<string, unknown>;
    const title = extractEventTitle(ev);
    if (!title) continue;

    const prob = extractYesProbability(ev);
    if (prob == null) continue;
    const volume = extractVolume(ev) ?? 0;

    // Best matching threat card by title keywords.
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
      probSource: "Polymarket",
      probHistory: nextHistory,
    });
  }

  return { ok: true, updates: Array.from(updatesById.values()) };
}

