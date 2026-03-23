import { computeHitRate } from "@/lib/backtesting/harness";

export async function POST(request: Request) {
  const body = (await request.json()) as {
    records: Array<{
      predictedDirection: "bullish" | "bearish" | "neutral";
      score: number;
      priceAtAlert: number;
      priceAtHorizon: number;
    }>;
  };
  return Response.json({ hitRate: computeHitRate(body.records) });
}
