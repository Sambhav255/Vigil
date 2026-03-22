import { buildDashboardSnapshot } from "@/lib/pipeline";

export const dynamic = "force-dynamic";

export async function GET() {
  const snapshot = await buildDashboardSnapshot();
  return Response.json(snapshot);
}
