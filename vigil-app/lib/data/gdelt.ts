import type { Threat } from "@/lib/types";
import { normalizeGdeltVolume } from "@/lib/scoring/core";
import { logSourceFailure } from "@/lib/logging/sourceLogger";

type ThreatUpdate = {
  id: number;
  volume?: number;
  probDelta?: number;
};

const FETCH_TIMEOUT_MS = 8_000;

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
    logSourceFailure("gdelt", "safeFetchJson failed", { url });
    return null;
  }
}

function countArticles(json: unknown): number {
  const j = json as Record<string, unknown>;
  if (Array.isArray(j?.articles)) return (j.articles as unknown[]).length;
  if (Array.isArray(j?.results)) return (j.results as unknown[]).length;
  if (Array.isArray(j?.data)) return (j.data as unknown[]).length;
  return 0;
}

function queryForCategory(category: string) {
  const c = category.toLowerCase();
  switch (c) {
    case "geopolitical":
      return "geopolitical";
    case "macroeconomic":
      return "macroeconomic OR inflation OR jobs OR unemployment";
    case "sentiment":
      return "stock market OR market sentiment";
    case "supply chain":
    case "supply chain ":
    case "supply chain,":
    case "supply chain.":
      return "supply chain OR shipping OR port disruption";
    case "climate":
      return "climate OR hurricane OR earthquake OR wildfire";
    default:
      return category;
  }
}

export async function fetchGdeltVolumeThreatUpdates(baseThreats: Threat[]): Promise<{
  ok: boolean;
  updates: ThreatUpdate[];
}> {
  const categories = Array.from(new Set(baseThreats.map((t) => t.category)));

  // Compute per-category "volume" using GDELT article counts.
  const volumesByCategory: Record<string, number> = {};

  for (const category of categories) {
    const query = queryForCategory(category);
    const globalQuery = "world";
    const [regionJson, globalJson] = await Promise.all([
      safeFetchJson<Record<string, unknown>>(
        `https://api.gdeltproject.org/api/v2/doc/doc?query=${encodeURIComponent(
          query
        )}&mode=ArtList&format=json`
      ),
      safeFetchJson<Record<string, unknown>>(
        `https://api.gdeltproject.org/api/v2/doc/doc?query=${encodeURIComponent(
          globalQuery
        )}&mode=ArtList&format=json`
      ),
    ]);

    const regionArticles = countArticles(regionJson) || 0;
    const globalArticles = countArticles(globalJson) || 0;

    // Scale to approximate "volume" used by confidence tiering.
    // normalizeGdeltVolume returns a ratio; we turn it into a large-enough number for tiers.
    const ratio = normalizeGdeltVolume(regionArticles, globalArticles, 100);
    volumesByCategory[category] = Math.round(ratio * 1000);
  }

  const updates: ThreatUpdate[] = [];
  for (const t of baseThreats) {
    if (!volumesByCategory[t.category]) continue;
    updates.push({ id: t.id, volume: volumesByCategory[t.category], probDelta: 0 });
  }

  return { ok: Object.keys(volumesByCategory).length > 0, updates };
}

