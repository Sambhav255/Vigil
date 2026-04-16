import { buildDashboardSnapshot } from "@/lib/pipeline";
import { FORCES, SECTORS, THREATS, TICKERS } from "@/lib/config/constants";
import type { SourceHealth } from "@/lib/types";
import { createHash } from "node:crypto";

export const dynamic = "force-dynamic";

// ── In-memory stale-while-revalidate cache ───────────────────────────────────
// Requests always get the cached value instantly (<1ms).
// A background refresh runs whenever the cache is older than TTL_MS.
const TTL_MS = 60_000; // 60s fresh window — external APIs can be slow

type Snapshot = Awaited<ReturnType<typeof buildDashboardSnapshot>>;

type CacheEntry = {
  snapshot: Snapshot;
  fetchedAt: number;
};

const SEED_SOURCE_KEYS = [
  "polymarket",
  "kalshi",
  "gdelt",
  "alphaVantage",
  "coinGecko",
  "usgs",
  "nasaEonet",
  "fred",
  "gprIndex",
  "geminiFlash",
] as const;

function buildSeedSnapshot(at: number): Snapshot {
  const loadingHealth: SourceHealth = { state: "stale", label: "loading", lastUpdatedMs: at };
  return {
    globalRisk: 48,
    gprIndex: 120,
    tickers: TICKERS.map((t) => ({ ...t })),
    threats: THREATS.map((t) => ({ ...t, compositeScore: 40 })),
    sectors: SECTORS.map((s) => ({ ...s })),
    forces: FORCES.map((f) => ({ ...f })),
    sourceHealth: Object.fromEntries(SEED_SOURCE_KEYS.map((k) => [k, { ...loadingHealth }])) as Snapshot["sourceHealth"],
  };
}

// Pre-populate with seed so the first request never blocks on a cold pipeline fetch
let cache: CacheEntry | null = {
  snapshot: buildSeedSnapshot(Date.now()),
  fetchedAt: Date.now() - TTL_MS - 1,
};
let refreshing = false;

async function refreshCache(): Promise<void> {
  if (refreshing) return;
  refreshing = true;
  try {
    const snapshot = await buildDashboardSnapshot();
    cache = { snapshot, fetchedAt: Date.now() };
  } catch {
    // keep stale cache on failure — better than an empty response
  } finally {
    refreshing = false;
  }
}

export async function GET(request: Request) {
  const now = Date.now();
  const stale = cache && now - cache.fetchedAt > TTL_MS;
  const empty = cache === null;

  if (empty) {
    await refreshCache();
  } else if (stale) {
    void refreshCache();
  }

  if (!cache) {
    return new Response("Service unavailable", { status: 503 });
  }

  const payload = JSON.stringify(cache.snapshot);
  const etag = `"${createHash("sha1").update(payload).digest("hex")}"`;
  const headerEtag = request.headers.get("if-none-match");

  if (headerEtag && headerEtag === etag) {
    return new Response(null, {
      status: 304,
      headers: {
        ETag: etag,
        "Cache-Control": "no-store",
      },
    });
  }

  return Response.json(cache.snapshot, {
    headers: {
      "Cache-Control": "no-store",
      ETag: etag,
      "X-Cache": empty ? "MISS" : stale ? "STALE" : "HIT",
      "X-Cache-Age": String(Math.round((now - cache.fetchedAt) / 1000)),
    },
  });
}
