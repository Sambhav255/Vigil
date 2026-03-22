import { FORCES, SECTORS, THREATS, TICKERS } from "@/lib/config/constants";
import type { ForceData, SectorData, SourceSnapshot, Threat } from "@/lib/types";

export type DashboardData = {
  threats: Threat[];
  tickers: Array<{ sym: string; price: number; chg: number }>;
  gprIndex: number;
  sectors: SectorData[];
  forces: ForceData[];
  sourceSnapshots: Record<string, SourceSnapshot>;
};

async function safeFetchJson<T>(url: string): Promise<T | null> {
  try {
    const res = await fetch(url, { cache: "no-store" });
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  }
}

export async function getDashboardData(): Promise<DashboardData> {
  const now = Date.now();
  const alphaKey = process.env.ALPHA_VANTAGE_API_KEY;
  const cgKey = process.env.COINGECKO_DEMO_API_KEY;

  const [polymarket, kalshi, gdelt, alpha, coingecko] = await Promise.all([
    safeFetchJson<unknown>("https://gamma-api.polymarket.com/events?limit=5"),
    safeFetchJson<unknown>("https://api.elections.kalshi.com/trade-api/v2/markets"),
    safeFetchJson<unknown>(
      "https://api.gdeltproject.org/api/v2/doc/doc?query=geopolitical&mode=ArtList&format=json"
    ),
    alphaKey
      ? safeFetchJson<unknown>(
          `https://www.alphavantage.co/query?function=BATCH_STOCK_QUOTES&symbols=SPY,QQQ,TSLA,NVDA&apikey=${alphaKey}`
        )
      : null,
    cgKey
      ? safeFetchJson<unknown>(
          `https://api.coingecko.com/api/v3/simple/price?ids=bitcoin,ethereum&vs_currencies=usd&include_24hr_change=true&x_cg_demo_api_key=${cgKey}`
        )
      : null,
  ]);

  return {
    threats: THREATS,
    tickers: TICKERS,
    gprIndex: 187,
    sectors: SECTORS,
    forces: FORCES,
    sourceSnapshots: {
      polymarket: { lastUpdatedMs: now, ok: !!polymarket },
      kalshi: { lastUpdatedMs: now, ok: !!kalshi },
      gdelt: { lastUpdatedMs: now, ok: !!gdelt },
      alphaVantage: { lastUpdatedMs: now, ok: !!alpha || !alphaKey },
      coinGecko: { lastUpdatedMs: now, ok: !!coingecko || !cgKey },
      gprIndex: { lastUpdatedMs: now, ok: true },
      geminiFlash: { lastUpdatedMs: now, ok: true },
    },
  };
}
