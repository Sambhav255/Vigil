export async function POST(request: Request) {
  const body = (await request.json()) as { threatTitle?: string };
  const threatTitle = body.threatTitle ?? "Unknown event";

  if (!process.env.GEMINI_API_KEY) {
    return Response.json(
      {
        ok: false,
        message: "AI temporarily unavailable",
      },
      { status: 503 }
    );
  }

  return Response.json({
    ok: true,
    analysis: `${threatTitle}: Deep-dive analysis placeholder. In production this route is rate-limited and only called by user intent.`,
  });
}
