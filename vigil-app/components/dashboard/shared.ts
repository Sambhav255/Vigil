import type { CSSProperties } from "react";

export const SEVERITY_COLOR: Record<string, string> = {
  critical: "#c42626",
  high: "#b07028",
  medium: "#2d6eb0",
  low: "#25784a",
};

export const SOURCE_DISPLAY: Record<string, string> = {
  polymarket: "Polymarket",
  kalshi: "Kalshi",
  gdelt: "GDELT",
  alphaVantage: "Alpha Vantage",
  coinGecko: "CoinGecko / Coinpaprika",
  usgs: "USGS Earthquakes",
  nasaEonet: "NASA EONET",
  fred: "FRED Macro",
  gprIndex: "GPR Index",
  geminiFlash: "Gemini Flash",
};

export function fmtPrice(p: number) {
  if (p >= 10_000) return p.toLocaleString("en-US", { maximumFractionDigits: 0 });
  return p.toFixed(2);
}

export function fmtVol(v: number) {
  if (v >= 1_000_000) return `$${(v / 1_000_000).toFixed(1)}M`;
  if (v >= 1_000) return `$${Math.round(v / 1000)}k`;
  return `$${v}`;
}

export function scoreHex(score: number) {
  if (score > 70) return SEVERITY_COLOR.critical;
  if (score > 55) return SEVERITY_COLOR.high;
  if (score > 35) return SEVERITY_COLOR.medium;
  return SEVERITY_COLOR.low;
}

export function truncateTitle(title: string, max = 32) {
  if (title.length <= max) return title;
  return `${title.slice(0, max)}…`;
}

// Convenience type for inline CSS custom properties.
export type CSSWithCustomProperties = CSSProperties & Record<string, string>;

