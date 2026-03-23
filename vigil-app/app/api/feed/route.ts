import { buildDashboardSnapshot } from "@/lib/pipeline";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const snapshot = await buildDashboardSnapshot();
    const threats = [...snapshot.threats]
      .sort((a, b) => (b.compositeScore ?? 0) - (a.compositeScore ?? 0))
      .map((t) => ({
        id: t.id,
        title: t.title,
        severity: t.severity,
        category: t.category,
        probability: t.probability,
        compositeScore: t.compositeScore ?? 0,
        createdAt: t.createdAt,
        assets: t.assets,
      }));

    return Response.json(
      {
        generatedAt: Date.now(),
        count: threats.length,
        threats,
      },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch {
    return Response.json({ ok: false, message: "Feed unavailable" }, { status: 503 });
  }
}
