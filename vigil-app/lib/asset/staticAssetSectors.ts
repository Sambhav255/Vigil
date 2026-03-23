export const STATIC_ASSET_SECTORS: Record<string, string[]> = {
  // US Technology
  AAPL: ["Technology"],
  MSFT: ["Technology"],
  GOOGL: ["Technology"],
  GOOG: ["Technology"],
  AMZN: ["Technology", "Commodities"],
  NVDA: ["Technology", "Defense"],
  META: ["Technology"],
  TSLA: ["Technology", "Energy"],
  AMD: ["Technology"],
  INTC: ["Technology"],
  QCOM: ["Technology"],
  AVGO: ["Technology"],
  ORCL: ["Technology"],
  CRM: ["Technology"],
  ADBE: ["Technology"],
  NOW: ["Technology"],

  // Taiwan / Chips (high geopolitical sensitivity)
  TSM: ["Technology", "Defense"],
  ASML: ["Technology"],

  // Chinese Tech
  BABA: ["Technology"],
  JD: ["Technology"],
  PDD: ["Technology"],
  BIDU: ["Technology"],

  // Finance
  JPM: ["Finance"],
  GS: ["Finance"],
  BAC: ["Finance"],
  MS: ["Finance"],
  WFC: ["Finance"],
  C: ["Finance"],
  BLK: ["Finance"],
  V: ["Finance"],
  MA: ["Finance"],

  // Defense / Aerospace
  LMT: ["Defense"],
  BA: ["Defense"],
  RTX: ["Defense"],
  NOC: ["Defense"],
  GD: ["Defense"],
  HII: ["Defense"],
  L3H: ["Defense"],

  // Energy
  XOM: ["Energy"],
  CVX: ["Energy"],
  COP: ["Energy"],
  SLB: ["Energy"],
  BP: ["Energy"],
  SHEL: ["Energy"],
  TTE: ["Energy"],
  CL: ["Energy"], // Crude oil futures
  NG: ["Energy"], // Natural gas

  // Broad market indices / ETFs
  SPY: ["Technology", "Finance", "Energy", "Defense", "Commodities"],
  QQQ: ["Technology"],
  IWM: ["Technology", "Finance"],
  DIA: ["Technology", "Finance", "Energy"],
  VIX: ["Technology", "Finance", "Energy", "Defense", "Commodities"],

  // Commodities / Safe havens
  GLD: ["Commodities"],
  SLV: ["Commodities"],
  GC: ["Commodities"],
  USO: ["Energy"],
  DXY: ["Finance", "Commodities"],
  GOLD: ["Commodities"],
  SILVER: ["Commodities"],

  // Crypto
  BTC: ["Crypto"],
  ETH: ["Crypto"],
  SOL: ["Crypto"],
  BNB: ["Crypto"],
  XRP: ["Crypto"],
  ADA: ["Crypto"],
  AVAX: ["Crypto"],
  DOT: ["Crypto"],
};

export function getStaticAssetSectors(sym: string): string[] {
  return STATIC_ASSET_SECTORS[sym.toUpperCase()] ?? [];
}

