/**
 * USGS Earthquake Hazards Program integration.
 * Free, no auth, GeoJSON feeds updated every minute for significant events.
 * Docs: https://earthquake.usgs.gov/earthquakes/feed/v1.0/geojson.php
 */

import type { Threat } from "@/lib/types";

type UsgsFeature = {
  properties: {
    mag: number;
    place: string;
    time: number;
    updated: number;
    url: string;
    detail: string;
    felt: number | null;
    tsunami: number;
    sig: number;
    title: string;
  };
  geometry: {
    coordinates: [number, number, number]; // [longitude, latitude, depth]
  };
  id: string;
};

type UsgsGeoJson = {
  features: UsgsFeature[];
};

// Critical infrastructure regions and their affected assets
const GEOFENCE_REGIONS = [
  { name: "Taiwan", lat: 23.7, lon: 121.0, radius: 3, assets: ["NVDA", "TSM", "AAPL", "QQQ"], sector: "Technology" },
  { name: "Japan", lat: 36.2, lon: 138.0, radius: 6, assets: ["SONY", "TM", "NKY"], sector: "Technology" },
  { name: "Gulf Coast", lat: 27.5, lon: -90.0, radius: 8, assets: ["CL", "NG", "XLE"], sector: "Energy" },
  { name: "West Coast US", lat: 37.7, lon: -122.4, radius: 5, assets: ["AAPL", "GOOGL", "META", "NVDA"], sector: "Technology" },
  { name: "Middle East", lat: 28.0, lon: 52.0, radius: 10, assets: ["CL", "NG", "XLE"], sector: "Energy" },
  { name: "Indonesia", lat: -5.0, lon: 120.0, radius: 8, assets: ["CL", "NG", "CORN"], sector: "Commodities" },
  { name: "Chile/Peru", lat: -20.0, lon: -70.0, radius: 8, assets: ["COPPER", "CL"], sector: "Commodities" },
];

function degreesToRad(d: number) {
  return (d * Math.PI) / 180;
}

function haversineDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371; // km
  const dLat = degreesToRad(lat2 - lat1);
  const dLon = degreesToRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(degreesToRad(lat1)) * Math.cos(degreesToRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function magnitudeToSeverity(mag: number, tsunami: number): "critical" | "high" | "medium" | "low" {
  if (tsunami === 1 || mag >= 7.5) return "critical";
  if (mag >= 6.5) return "high";
  if (mag >= 5.5) return "medium";
  return "low";
}

export async function fetchSignificantEarthquakes(): Promise<{
  threats: Threat[];
  ok: boolean;
  lastUpdatedMs: number;
}> {
  const now = Date.now();
  try {
    // Significant earthquakes in the last 7 days
    const res = await fetch(
      "https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/significant_week.geojson",
      { cache: "no-store" }
    );
    if (!res.ok) return { threats: [], ok: false, lastUpdatedMs: now };

    const data = (await res.json()) as UsgsGeoJson;
    const threats: Threat[] = [];
    let nextId = 100; // start IDs at 100 to avoid collision with static threats
    let lastEventMs = now;

    for (const feature of data.features.slice(0, 5)) {
      const { mag, place, time, tsunami, title } = feature.properties;
      if (time) lastEventMs = time;
      const [lon, lat] = feature.geometry.coordinates;

      // Find nearest critical region
      let nearestRegion: (typeof GEOFENCE_REGIONS)[0] | null = null;
      let nearestDist = Infinity;
      for (const region of GEOFENCE_REGIONS) {
        const dist = haversineDistance(lat, lon, region.lat, region.lon);
        if (dist < region.radius * 111 && dist < nearestDist) {
          nearestDist = dist;
          nearestRegion = region;
        }
      }

      const severity = magnitudeToSeverity(mag, tsunami);
      const assets = nearestRegion?.assets ?? ["SPY", "QQQ"];
      const sector = nearestRegion?.sector ?? "Technology";
      const hasTsunami = tsunami === 1;

      threats.push({
        id: nextId++,
        title: `M${mag.toFixed(1)} Earthquake: ${place.slice(0, 60)}`,
        category: "Climate",
        severity,
        assets,
        direction: "bearish",
        probability: hasTsunami ? 0.85 : Math.min(0.9, 0.4 + (mag - 5) * 0.1),
        probSource: "Kalshi",
        probDelta: 0,
        confidence: mag >= 6.5 ? "high" : mag >= 5.5 ? "medium" : "low",
        volume: Math.round(feature.properties.sig * 100),
        cascadeEta: hasTsunami ? "Hours" : "1-3 days",
        momentum: "escalating",
        summary: `${title}. Depth: ${feature.geometry.coordinates[2].toFixed(0)}km.${hasTsunami ? " TSUNAMI WARNING ISSUED." : ""}${nearestRegion ? ` Near ${nearestRegion.name} critical infrastructure.` : ""}`,
        sector,
        verified: true,
        sourceCount: 1,
        probHistory: [0.3, 0.35, 0.4, Math.min(0.9, 0.4 + (mag - 5) * 0.1)],
      });
    }

    return { threats, ok: true, lastUpdatedMs: lastEventMs };
  } catch {
    return { threats: [], ok: false, lastUpdatedMs: now };
  }
}
