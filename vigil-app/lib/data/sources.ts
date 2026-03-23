import { FORCES, SECTORS, THREATS, TICKERS } from "@/lib/config/constants";
import { fetchFredData, computeMacroStressScore } from "@/lib/data/fred";
import { fetchSignificantEarthquakes } from "@/lib/data/usgs";
import { fetchNasaEonetEvents } from "@/lib/data/eonet";
import type { ForceData, SectorData, SourceSnapshot, Threat } from "@/lib/types";

export type DashboardData = {
  threats: Threat[];
  tickers: Array<{ sym: string; price: number; chg: number }>;
  gprIndex: number;
  sectors: SectorData[];
  forces: ForceData[];
  sourceSnapshots: Record<string, SourceSnapshot>;
};

// 8 s hard timeout per external source — prevents one slow API from blocking everything
const FETCH_TIMEOUT_MS = 8_000;

async function safeFetchJson<T>(url: string, options?: RequestInit): Promise<T | null> {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
    try {
      const res = await fetch(url, { cache: "no-store", signal: controller.signal, ...options });
      if (!res.ok) return null;
      return (await res.json()) as T;
    } finally {
      clearTimeout(timer);
    }
  } catch {
    return null;
  }
}

type CoinpaprikaPrice = {
  quotes?: { USD?: { price?: number; percent_change_24h?: number } };
};

async function fetchCoinpaprikaFallback(): Promise<{
  btc: { price: number; chg: number } | null;
  eth: { price: number | null; chg: number | null } | null;
}> {
  const [btc, eth] = await Promise.all([
    safeFetchJson<CoinpaprikaPrice>("https://api.coinpaprika.com/v1/tickers/btc-bitcoin"),
    safeFetchJson<CoinpaprikaPrice>("https://api.coinpaprika.com/v1/tickers/eth-ethereum"),
  ]);
  return {
    btc: btc?.quotes?.USD?.price != null
      ? { price: btc.quotes.USD.price, chg: btc.quotes.USD.percent_change_24h ?? 0 }
      : null,
    eth: eth?.quotes?.USD?.price != null
      ? { price: eth.quotes.USD.price, chg: eth.quotes.USD.percent_change_24h ?? 0 }
      : null,
  };
}

export async function getDashboardData(): Promise<DashboardData> {
  const now = Date.now();
  const alphaKey = process.env.ALPHA_VANTAGE_API_KEY;
  const cgKey = process.env.COINGECKO_DEMO_API_KEY;
  const fredKey = process.env.FRED_API_KEY;

  // Fetch all sources in parallel
  const [polymarket, kalshi, gdelt, alpha, coingecko, usgsResult, eonetResult, fredData] =
    await Promise.all([
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
      fetchSignificantEarthquakes(),
      fetchNasaEonetEvents(),
      fredKey ? fetchFredData(fredKey) : null,
    ]);

  // Crypto fallback: if CoinGecko is unavailable, use Coinpaprika (free, no auth)
  const coinpaprika = !coingecko ? await fetchCoinpaprikaFallback() : null;
  const cryptoOk = !!coingecko || !!coinpaprika?.btc;

  // Build tickers — upgrade BTC/ETH with live data if available
  let tickers = [...TICKERS];
  if (coingecko) {
    const cg = coingecko as {
      bitcoin?: { usd?: number; usd_24h_change?: number };
      ethereum?: { usd?: number; usd_24h_change?: number };
    };
    tickers = tickers.map((t) => {
      if (t.sym === "BTC" && cg.bitcoin?.usd) {
        return { ...t, price: cg.bitcoin.usd, chg: cg.bitcoin.usd_24h_change ?? t.chg };
      }
      if (t.sym === "ETH" && cg.ethereum?.usd) {
        return { ...t, price: cg.ethereum.usd, chg: cg.ethereum.usd_24h_change ?? t.chg };
      }
      return t;
    });
  } else if (coinpaprika) {
    tickers = tickers.map((t) => {
      if (t.sym === "BTC" && coinpaprika.btc) {
        return { ...t, price: coinpaprika.btc.price, chg: coinpaprika.btc.chg };
      }
      if (t.sym === "ETH" && coinpaprika.eth !== null && coinpaprika.eth.price !== null) {
        return { ...t, price: coinpaprika.eth.price, chg: coinpaprika.eth.chg ?? t.chg };
      }
      return t;
    });
  }

  // Merge dynamic threat cards from USGS + EONET with static baseline
  const dynamicThreats: Threat[] = [
    ...usgsResult.threats,
    ...eonetResult.threats,
  ];
  const threats = [...THREATS, ...dynamicThreats];

  // Build forces — use FRED macro score if available, else static fallback
  const macroScore = fredData ? computeMacroStressScore(fredData) : FORCES.find((f) => f.name === "Macro")?.score ?? 61;
  const forces: ForceData[] = FORCES.map((f) =>
    f.name === "Macro" ? { ...f, score: macroScore } : f
  );

  // Adjust climate force score if USGS/EONET detected active events
  const hasActiveNaturalEvents = usgsResult.threats.length > 0 || eonetResult.threats.length > 0;
  const climateForces = forces.map((f) =>
    f.name === "Climate" && hasActiveNaturalEvents
      ? { ...f, score: Math.min(100, f.score + 15) }
      : f
  );

  return {
    threats,
    tickers,
    gprIndex: 187,
    sectors: SECTORS,
    forces: climateForces,
    sourceSnapshots: {
      polymarket: { lastUpdatedMs: now, ok: !!polymarket },
      kalshi: { lastUpdatedMs: now, ok: !!kalshi },
      gdelt: { lastUpdatedMs: now, ok: !!gdelt },
      alphaVantage: { lastUpdatedMs: now, ok: !!alpha || !alphaKey },
      coinGecko: { lastUpdatedMs: now, ok: cryptoOk },
      usgs: { lastUpdatedMs: usgsResult.lastUpdatedMs, ok: usgsResult.ok },
      nasaEonet: { lastUpdatedMs: eonetResult.lastUpdatedMs, ok: eonetResult.ok },
      fred: { lastUpdatedMs: now, ok: !!fredData || !fredKey },
      gprIndex: { lastUpdatedMs: now, ok: true },
      geminiFlash: { lastUpdatedMs: now, ok: true },
    },
  };
}
