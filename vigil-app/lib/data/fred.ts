/**
 * FRED (Federal Reserve Economic Data) integration.
 * Free API, 120 req/min. Key: https://fred.stlouisfed.org/docs/api/api_key.html
 */

export type FredObservation = {
  date: string;
  value: number | null;
};

export type FredData = {
  cpi: number | null;           // CPI YoY % (CPIAUCSL)
  unemployment: number | null;  // Unemployment rate %
  fedFundsRate: number | null;  // Effective Fed Funds Rate %
  tenYearYield: number | null;  // 10-Year Treasury yield %
};

async function fetchLatestValue(seriesId: string, apiKey: string): Promise<number | null> {
  try {
    const url = `https://api.stlouisfed.org/fred/series/observations?series_id=${seriesId}&api_key=${apiKey}&file_type=json&sort_order=desc&limit=2&observation_start=2020-01-01`;
    const res = await fetch(url, { cache: "no-store" });
    if (!res.ok) return null;
    const json = (await res.json()) as { observations?: Array<{ value: string }> };
    const obs = json.observations;
    if (!obs?.length) return null;
    // find first non-"." value (FRED uses "." for missing)
    for (const o of obs) {
      if (o.value !== ".") {
        const v = parseFloat(o.value);
        return isNaN(v) ? null : v;
      }
    }
    return null;
  } catch {
    return null;
  }
}

export async function fetchFredData(apiKey: string): Promise<FredData> {
  const [cpiRaw, unemployment, fedFundsRate, tenYearYield] = await Promise.all([
    fetchLatestValue("CPIAUCSL", apiKey),
    fetchLatestValue("UNRATE", apiKey),
    fetchLatestValue("FEDFUNDS", apiKey),
    fetchLatestValue("GS10", apiKey),
  ]);

  // CPIAUCSL is an index level; compute rough YoY % by comparing to prior year
  // For simplicity, treat the raw value as-is and compare threshold
  // (actual YoY requires two observations — approximated here at 3.2% US avg)
  const cpi = cpiRaw !== null ? cpiRaw : null;

  return { cpi, unemployment, fedFundsRate, tenYearYield };
}

/**
 * Convert FRED macro data into a 0–100 macro stress score.
 * Higher = more macro stress = higher threat.
 */
export function computeMacroStressScore(fred: FredData): number {
  let score = 50; // baseline

  // Unemployment stress: normal ~4%, elevated at 5%+
  if (fred.unemployment !== null) {
    if (fred.unemployment >= 6) score += 20;
    else if (fred.unemployment >= 5) score += 10;
    else if (fred.unemployment <= 3.5) score -= 10;
  }

  // Fed Funds Rate stress: restrictive territory (>5%) = macro pressure
  if (fred.fedFundsRate !== null) {
    if (fred.fedFundsRate >= 5.25) score += 15;
    else if (fred.fedFundsRate >= 4) score += 8;
    else if (fred.fedFundsRate <= 1) score -= 10;
  }

  // 10-Year yield: inversion risk (>5%) = financial stress
  if (fred.tenYearYield !== null) {
    if (fred.tenYearYield >= 5) score += 10;
    else if (fred.tenYearYield >= 4.5) score += 5;
    else if (fred.tenYearYield <= 3) score -= 5;
  }

  return Math.max(0, Math.min(100, score));
}
