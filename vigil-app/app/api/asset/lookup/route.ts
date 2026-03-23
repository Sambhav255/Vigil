import { getStaticAssetSectors } from "@/lib/asset/staticAssetSectors";
import { mapAlphaOverviewToVigilSectors } from "@/lib/asset/alphaSectorMapping";

type AlphaOverview = {
  Symbol?: string;
  Name?: string;
  Sector?: string;
  Industry?: string;
  AssetType?: string;
  Note?: string;
};

type AssetLookupResponse = {
  ok: boolean;
  symbol: string;
  name?: string | null;
  sectors: string[];
  source: "alphaVantage" | "static" | "fallback";
};

const FETCH_TIMEOUT_MS = 8_000;
const TTL_MS = 6 * 60 * 60 * 1000; // 6 hours

const cache = new Map<string, { fetchedAt: number; value: AssetLookupResponse }>();
const inFlight = new Map<string, Promise<AssetLookupResponse>>();

function safeFetchJson<T>(url: string): Promise<T | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  return fetch(url, { cache: "no-store", signal: controller.signal })
    .then(async (res) => {
      if (!res.ok) return null;
      return (await res.json()) as T;
    })
    .catch(() => null)
    .finally(() => clearTimeout(timer));
}

function fallbackSectorsForSymbol(sym: string): string[] {
  // Prefer our static map for known items, even if Alpha is unavailable.
  const staticSectors = getStaticAssetSectors(sym);
  if (staticSectors.length) return staticSectors;
  // If we don't know anything about it, default to Technology so the UI still shows contextual risk.
  return ["Technology"];
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const symbolRaw = url.searchParams.get("symbol");
  const symbol = (symbolRaw ?? "").toUpperCase().trim();

  if (!symbol) {
    return Response.json({ ok: false, symbol: "", sectors: [], source: "fallback" } satisfies AssetLookupResponse, {
      status: 400,
    });
  }

  const cached = cache.get(symbol);
  if (cached && Date.now() - cached.fetchedAt < TTL_MS) {
    return Response.json(cached.value);
  }

  const existing = inFlight.get(symbol);
  if (existing) return Response.json(await existing);

  const promise = (async (): Promise<AssetLookupResponse> => {
    const apiKey = process.env.ALPHA_VANTAGE_API_KEY;

    // Fast path: static mapping available
    const staticSectors = getStaticAssetSectors(symbol);
    if (staticSectors.length && (!apiKey || staticSectors.length >= 1)) {
      return {
        ok: true,
        symbol,
        name: null,
        sectors: staticSectors,
        source: "static",
      };
    }

    if (!apiKey) {
      return {
        ok: true,
        symbol,
        name: null,
        sectors: fallbackSectorsForSymbol(symbol),
        source: "fallback",
      };
    }

    const overview = await safeFetchJson<AlphaOverview>(
      `https://www.alphavantage.co/query?function=OVERVIEW&symbol=${encodeURIComponent(symbol)}&apikey=${encodeURIComponent(
        apiKey
      )}`
    );

    if (!overview || overview.Note) {
      return {
        ok: true,
        symbol,
        name: null,
        sectors: fallbackSectorsForSymbol(symbol),
        source: "fallback",
      };
    }

    const sectors = mapAlphaOverviewToVigilSectors({
      sector: overview.Sector,
      industry: overview.Industry,
      assetType: overview.AssetType,
      symbol: symbol,
    });

    return {
      ok: true,
      symbol,
      name: overview.Name ?? null,
      sectors,
      source: "alphaVantage",
    };
  })();

  inFlight.set(symbol, promise);
  try {
    const value = await promise;
    cache.set(symbol, { fetchedAt: Date.now(), value });
    return Response.json(value);
  } finally {
    inFlight.delete(symbol);
  }
}

