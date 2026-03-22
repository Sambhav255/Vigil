import { promises as fs } from "node:fs";
import path from "node:path";

type HitRateEvent = {
  id: string;
  ticker: string;
  direction: "bullish" | "bearish" | "neutral";
  score: number;
  priceAtAlert: number;
  createdAt: number;
};

const LOG_PATH = path.join(process.cwd(), "data", "hit-rate-log.json");

async function readAll(): Promise<HitRateEvent[]> {
  try {
    const data = await fs.readFile(LOG_PATH, "utf8");
    return JSON.parse(data) as HitRateEvent[];
  } catch {
    return [];
  }
}

export async function logHitRateEvent(event: HitRateEvent) {
  try {
    const existing = await readAll();
    await fs.mkdir(path.dirname(LOG_PATH), { recursive: true });
    await fs.writeFile(LOG_PATH, JSON.stringify([...existing, event], null, 2), "utf8");
  } catch {
    // No-op in read-only environments (e.g. Vercel serverless)
  }
}
