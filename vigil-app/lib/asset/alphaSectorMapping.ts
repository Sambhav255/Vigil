export type VigilSector = "Technology" | "Finance" | "Defense" | "Energy" | "Commodities" | "Crypto";

function contains(haystack: string | undefined | null, ...needles: string[]) {
  const h = (haystack ?? "").toLowerCase();
  return needles.some((n) => h.includes(n.toLowerCase()));
}

function unique(arr: VigilSector[]): VigilSector[] {
  return [...new Set(arr)];
}

/**
 * Maps Alpha Vantage `OVERVIEW` fields (Sector/Industry/AssetType) into Vigil's internal
 * threat sectors so we can relate arbitrary symbols to the correct threat cards.
 */
export function mapAlphaOverviewToVigilSectors(input: {
  sector?: string | null;
  industry?: string | null;
  assetType?: string | null;
  symbol?: string | null;
}): VigilSector[] {
  const alphaSector = (input.sector ?? "").trim();
  const alphaIndustry = (input.industry ?? "").trim();
  const alphaAssetType = (input.assetType ?? "").trim();
  const symbol = (input.symbol ?? "").toUpperCase().trim();

  // ETF / broad indices
  if (contains(alphaAssetType, "etf") || contains(alphaSector, "etf") || ["SPY", "QQQ", "IWM", "DIA"].includes(symbol)) {
    return unique(["Technology", "Finance", "Energy", "Defense", "Commodities"]);
  }

  // Crypto isn't reliably returned in Alpha's OVERVIEW for tickers like BTC/ETH,
  // but we still provide a lightweight heuristic.
  if (["BTC", "ETH", "SOL", "BNB", "XRP", "ADA", "AVAX", "DOT"].includes(symbol)) {
    return ["Crypto"];
  }

  // Defense detection (industry-level usually carries it)
  if (
    contains(alphaIndustry, "aerospace", "defense", "military", "weapons", "integrated defense") ||
    contains(alphaSector, "industrials") && contains(alphaIndustry, "defense")
  ) {
    return ["Defense"];
  }

  if (contains(alphaSector, "technology") || contains(alphaIndustry, "software", "semiconductor", "internet")) {
    return ["Technology"];
  }

  if (contains(alphaSector, "financial") || contains(alphaSector, "real estate") || contains(alphaIndustry, "bank", "insurance", "broker", "asset management")) {
    return ["Finance"];
  }

  if (contains(alphaSector, "energy") || contains(alphaIndustry, "oil", "gas", "refining", "petroleum", "utilities")) {
    return ["Energy"];
  }

  if (contains(alphaSector, "basic materials", "materials") || contains(alphaIndustry, "gold", "silver", "chemicals", "metals", "lithium", "copper", "commodity")) {
    return ["Commodities"];
  }

  if (contains(alphaIndustry, "gold", "precious")) return ["Commodities"];

  // Fallback: put most "unknown" equities into Technology so they still get contextual
  // threat coverage rather than disappearing into zero-risk.
  return ["Technology"];
}

