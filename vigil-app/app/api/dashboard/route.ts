import { buildDashboardSnapshot } from "@/lib/pipeline";

export const dynamic = "force-dynamic";

// ── In-memory stale-while-revalidate cache ───────────────────────────────────
// Requests always get the cached value instantly (<1ms).
// A background refresh runs whenever the cache is older than TTL_MS.
const TTL_MS = 30_000; // 30 s — matches the pipeline's own SOURCE_STALE_AFTER_MS

type CacheEntry = {
  snapshot: Awaited<ReturnType<typeof buildDashboardSnapshot>>;
  fetchedAt: number;
};

let cache: CacheEntry | null = null;
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

export async function GET() {
  const now = Date.now();
  const stale = cache && now - cache.fetchedAt > TTL_MS;
  const empty = cache === null;

  if (empty) {
    // Cold start — must wait for the first fetch
    await refreshCache();
  } else if (stale) {
    // Serve stale immediately, refresh in background
    void refreshCache();
  }

  if (!cache) {
    return new Response("Service unavailable", { status: 503 });
  }

  return Response.json(cache.snapshot, {
    headers: {
      "Cache-Control": "no-store",
      "X-Cache": empty ? "MISS" : stale ? "STALE" : "HIT",
      "X-Cache-Age": String(Math.round((now - cache.fetchedAt) / 1000)),
    },
  });
}
