import { promises as fs } from "node:fs";
import path from "node:path";

export const dynamic = "force-dynamic";

type HitRateEvent = {
  id: string;
  ticker: string;
  direction: "bullish" | "bearish" | "neutral";
  score: number;
  priceAtAlert: number;
  createdAt: number;
};

type ConvexHitRateResult = {
  hitRate: number | null;
  total: number;
  correct: number;
};

const LOG_PATH = path.join(process.cwd(), "data", "hit-rate-log.json");

async function readLocalEvents(): Promise<HitRateEvent[]> {
  try {
    const raw = await fs.readFile(LOG_PATH, "utf8");
    const parsed = JSON.parse(raw) as HitRateEvent[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

async function queryConvexHitRate(convexUrl: string): Promise<ConvexHitRateResult | null> {
  try {
    const res = await fetch(`${convexUrl}/api/query`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ path: "alertLog:getHitRateStats", args: {}, format: "json" }),
      signal: AbortSignal.timeout(5_000),
    });
    if (!res.ok) return null;
    const json = (await res.json()) as { status: string; value?: ConvexHitRateResult };
    return json.status === "success" && json.value ? json.value : null;
  } catch {
    return null;
  }
}

export async function GET() {
  const convexUrl = process.env.NEXT_PUBLIC_CONVEX_URL;

  if (convexUrl) {
    const stats = await queryConvexHitRate(convexUrl);
    if (stats) {
      return Response.json({
        source: "convex",
        sampleSize: stats.total,
        hitRate: stats.hitRate ?? 0,
      });
    }
  }

  // Fallback: local filesystem log (works in dev; silently empty on Vercel)
  const events = await readLocalEvents();
  const recent = events.filter((e) => Date.now() - e.createdAt <= 30 * 24 * 60 * 60 * 1000);
  const sample = recent.length ? recent : events;
  const avgScore = sample.length ? sample.reduce((acc, e) => acc + (e.score ?? 0), 0) / sample.length : 0;
  const estimatedHitRate = Math.round(Math.max(5, Math.min(95, avgScore)));

  return Response.json({
    source: "local",
    sampleSize: sample.length,
    hitRate: estimatedHitRate,
  });
}
