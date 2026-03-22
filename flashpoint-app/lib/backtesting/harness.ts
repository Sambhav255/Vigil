type BacktestRecord = {
  predictedDirection: "bullish" | "bearish" | "neutral";
  score: number;
  priceAtAlert: number;
  priceAtHorizon: number;
};

export function computeHitRate(records: BacktestRecord[]) {
  if (records.length === 0) return 0;
  const hits = records.filter((r) => {
    if (r.predictedDirection === "neutral") return true;
    const delta = r.priceAtHorizon - r.priceAtAlert;
    return r.predictedDirection === "bullish" ? delta > 0 : delta < 0;
  }).length;
  return (hits / records.length) * 100;
}
