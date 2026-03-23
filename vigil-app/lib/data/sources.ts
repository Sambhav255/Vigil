import { FORCES, SECTORS, THREATS, TICKERS } from "@/lib/config/constants";
import { fetchFredData, computeMacroStressScore } from "@/lib/data/fred";
import { fetchGprIndex } from "@/lib/data/gpr";
import { fetchPolymarketThreatUpdates } from "@/lib/data/polymarket";
import { fetchKalshiThreatUpdates } from "@/lib/data/kalshi";
import { fetchGdeltVolumeThreatUpdates } from "@/lib/data/gdelt";
import { fetchSignificantEarthquakes } from "@/lib/data/usgs";
import { fetchNasaEonetEvents } from "@/lib/data/eonet";
import type { ForceData, SectorData, SourceSnapshot, Threat } from "@/lib/types";
import { logSourceFailure } from "@/lib/logging/sourceLogger";

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
    logSourceFailure("sources", "safeFetchJson failed", { url });
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

function parseAlphaVantageBatchStockQuotes(json: unknown): Map<string, { price: number; chg: number }> | null {
  if (!json || typeof json !== "object") return null;
  const obj = json as Record<string, unknown>;

  const quotes =
    (Array.isArray(obj["Stock Quotes"]) ? obj["Stock Quotes"] : null) ||
    (Array.isArray(obj["stockQuotes"]) ? obj["stockQuotes"] : null) ||
    (Array.isArray(obj["quotes"]) ? obj["quotes"] : null);
  if (!quotes) return null;

  const out = new Map<string, { price: number; chg: number }>();
  for (const row of quotes) {
    if (!row || typeof row !== "object") continue;
    const r = row as Record<string, unknown>;

    const sym =
      (typeof r["1. symbol"] === "string" && r["1. symbol"]) ||
      (typeof r["symbol"] === "string" && r["symbol"]) ||
      (typeof r["t"] === "string" && r["t"]) ||
      null;

    const priceRaw = (r["2. price"] ?? r["price"]) as unknown;
    const chgRaw = (r["3. percent change"] ?? r["chg"] ?? r["change"]) as unknown;

    const price =
      typeof priceRaw === "number"
        ? priceRaw
        : typeof priceRaw === "string"
          ? Number(priceRaw)
          : null;
    const chg =
      typeof chgRaw === "number"
        ? chgRaw
        : typeof chgRaw === "string"
          ? Number(chgRaw)
          : null;

    if (!sym || !Number.isFinite(price) || !Number.isFinite(chg)) continue;
    out.set(String(sym), { price: price as number, chg: chg as number });
  }

  return out;
}

export async function getDashboardData(): Promise<DashboardData> {
  const now = Date.now();
  const alphaKey = process.env.ALPHA_VANTAGE_API_KEY;
  const cgKey = process.env.COINGECKO_DEMO_API_KEY;
  const fredKey = process.env.FRED_API_KEY;
  const gprKey = true;

  // Clone seed threats so we can apply live updates (probability/volume/probDelta/probHistory).
  // Seed `THREATS` is treated as a read-only baseline.
  const baseThreats: Threat[] = THREATS.map((t) => ({ ...t, probHistory: [...t.probHistory] }));

  // Fetch all sources in parallel
  const [polymarketRes, kalshiRes, gdeltRes, alpha, coingecko, usgsResult, eonetResult, fredData, gprIndexValue] =
    await Promise.all([
      fetchPolymarketThreatUpdates(baseThreats),
      fetchKalshiThreatUpdates(baseThreats),
      fetchGdeltVolumeThreatUpdates(baseThreats),
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
      gprKey ? fetchGprIndex() : Promise.resolve(120),
    ]);

  // Crypto fallback: if CoinGecko is unavailable, use Coinpaprika (free, no auth)
  const coinpaprika = !coingecko ? await fetchCoinpaprikaFallback() : null;
  const cryptoOk = !!coingecko || !!coinpaprika?.btc;

  // Build tickers — upgrade BTC/ETH with live data if available
  let tickers = [...TICKERS];

  // Upgrade US equities with Alpha Vantage if available.
  if (alpha) {
    const alphaQuotes = parseAlphaVantageBatchStockQuotes(alpha);
    if (alphaQuotes && alphaQuotes.size > 0) {
      tickers = tickers.map((t) => {
        const q = alphaQuotes.get(t.sym);
        return q ? { ...t, price: q.price, chg: q.chg } : t;
      });
    }
  }

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

  // Apply live threat updates (Polymarket/Kalshi/GDELT) onto seed threats.
  const applyThreatUpdates = (updates: Array<{ id: number }>) => {
    const byId = new Map(baseThreats.map((t) => [t.id, t]));
    for (const u of updates) {
      const t = byId.get(u.id);
      if (!t) continue;
      Object.assign(t, u);
    }
  };

  applyThreatUpdates(polymarketRes.updates);
  applyThreatUpdates(kalshiRes.updates);
  applyThreatUpdates(gdeltRes.updates);

  // Merge dynamic threat cards from USGS + EONET with static baseline
  const dynamicThreats: Threat[] = [
    ...usgsResult.threats,
    ...eonetResult.threats,
  ];
  const threats = [...baseThreats, ...dynamicThreats];

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
    gprIndex: gprIndexValue,
    sectors: SECTORS,
    forces: climateForces,
    sourceSnapshots: {
      polymarket: { lastUpdatedMs: now, ok: polymarketRes.ok },
      kalshi: { lastUpdatedMs: now, ok: kalshiRes.ok },
      gdelt: { lastUpdatedMs: now, ok: gdeltRes.ok },
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
