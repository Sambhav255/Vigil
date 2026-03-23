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

const LOG_PATH = path.join(process.cwd(), "data", "hit-rate-log.json");

async function readEvents(): Promise<HitRateEvent[]> {
  try {
    const raw = await fs.readFile(LOG_PATH, "utf8");
    const parsed = JSON.parse(raw) as HitRateEvent[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export async function GET() {
  const events = await readEvents();
  const recent = events.filter((e) => Date.now() - e.createdAt <= 30 * 24 * 60 * 60 * 1000);
  const sample = recent.length ? recent : events;
  const avgScore = sample.length ? sample.reduce((acc, e) => acc + (e.score ?? 0), 0) / sample.length : 0;
  const estimatedHitRate = Math.round(Math.max(5, Math.min(95, avgScore)));

  return Response.json({
    source: process.env.NEXT_PUBLIC_CONVEX_URL ? "convex_or_local" : "local",
    sampleSize: sample.length,
    hitRate: estimatedHitRate,
  });
}
