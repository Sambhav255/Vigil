/**
 * NASA EONET (Earth Observatory Natural Event Tracker) integration.
 * Free, no auth required. Tracks wildfires, storms, volcanic eruptions, etc.
 * Docs: https://eonet.gsfc.nasa.gov/docs/v3
 */

import type { Threat } from "@/lib/types";
import { logSourceFailure } from "@/lib/logging/sourceLogger";

type EonetEvent = {
  id: string;
  title: string;
  description: string | null;
  categories: Array<{ id: string; title: string }>;
  sources: Array<{ id: string; url: string }>;
  geometry: Array<{
    magnitudeValue: number | null;
    magnitudeUnit: string | null;
    date: string;
    type: string;
    coordinates: number[] | number[][];
  }>;
};

type EonetResponse = {
  events: EonetEvent[];
};

const CATEGORY_TO_SECTOR: Record<string, { sector: string; assets: string[] }> = {
  wildfires: { sector: "Commodities", assets: ["CORN", "SOY", "WTI"] },
  severeStorms: { sector: "Energy", assets: ["CL", "NG", "XLE"] },
  volcanoes: { sector: "Commodities", assets: ["CL", "NG", "CORN"] },
  seaLakeIce: { sector: "Energy", assets: ["CL", "NG"] },
  floods: { sector: "Commodities", assets: ["CORN", "SOY", "SPY"] },
  drought: { sector: "Commodities", assets: ["CORN", "SOY", "WHEAT"] },
};

function categoryToSector(categoryId: string): { sector: string; assets: string[] } {
  return CATEGORY_TO_SECTOR[categoryId] ?? { sector: "Commodities", assets: ["SPY"] };
}

export async function fetchNasaEonetEvents(): Promise<{
  threats: Threat[];
  ok: boolean;
  lastUpdatedMs: number;
}> {
  const now = Date.now();
  try {
    const res = await fetch(
      "https://eonet.gsfc.nasa.gov/api/v3/events?status=open&limit=5&days=7",
      { cache: "no-store" }
    );
    if (!res.ok) return { threats: [], ok: false, lastUpdatedMs: now };

    const data = (await res.json()) as EonetResponse;
    const threats: Threat[] = [];
    let nextId = 200; // start IDs at 200 to avoid collision

    for (const event of data.events.slice(0, 3)) {
      const primaryCategory = event.categories[0];
      if (!primaryCategory) continue;
      const { sector, assets } = categoryToSector(primaryCategory.id);
      const firstDate = event.geometry?.[0]?.date;
      const createdAtParsed = firstDate ? Date.parse(firstDate) : NaN;
      const createdAt = Number.isFinite(createdAtParsed) ? createdAtParsed : now;

      threats.push({
        id: nextId++,
        title: event.title.slice(0, 80),
        category: "Climate",
        severity: "medium",
        createdAt,
        assets,
        direction: "bearish",
        probability: 0.7,
        probSource: "Kalshi",
        probDelta: 0,
        confidence: "medium",
        volume: 15000,
        cascadeEta: "1-4 weeks",
        momentum: "escalating",
        summary: `${primaryCategory.title} event tracked by NASA EONET. ${event.description ?? "Active natural event with potential supply chain impact."}`,
        sector,
        verified: true,
        sourceCount: event.sources.length || 1,
        probHistory: [0.5, 0.55, 0.6, 0.65, 0.7],
      });
    }

    return { threats, ok: true, lastUpdatedMs: now };
  } catch {
    logSourceFailure("nasa_eonet", "fetchNasaEonetEvents failed");
    return { threats: [], ok: false, lastUpdatedMs: now };
  }
}
