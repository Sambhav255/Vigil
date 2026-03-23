export const dynamic = "force-dynamic";

type AnalyzeRequestBody = {
  threatTitle?: string;
  category?: string;
  severity?: string;
  assets?: string[];
  probability?: number;
};

let lastGeminiCallAt = 0;

export async function POST(request: Request) {
  if (!process.env.GEMINI_API_KEY) {
    return Response.json(
      {
        ok: false,
        message: "AI temporarily unavailable",
      },
      { status: 503 }
    );
  }

  const body = (await request.json()) as AnalyzeRequestBody;
  const threatTitle = body.threatTitle ?? "Unknown event";

  // Rate-limit: 1 call per 30 seconds (free-tier safe).
  const now = Date.now();
  const minIntervalMs = 30_000;
  const delta = now - lastGeminiCallAt;
  if (delta < minIntervalMs) {
    const retryAfterSec = Math.ceil((minIntervalMs - delta) / 1000);
    return new Response(
      JSON.stringify({ ok: false, message: "Rate limited. Try again shortly." }),
      { status: 429, headers: { "Retry-After": String(retryAfterSec) } }
    );
  }
  lastGeminiCallAt = now;

  const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${process.env.GEMINI_API_KEY}`;
  const prompt = `You are a geopolitical risk analyst. Analyze this threat for a financial trader:

Threat: ${threatTitle}
Category: ${body.category ?? "Unknown"}
Severity: ${body.severity ?? "Unknown"}
Affected Assets: ${body.assets?.join(", ") ?? "Unknown"}
Current Probability: ${body.probability ?? "Unknown"}

Provide:
1. A 2-3 sentence executive summary of what's happening
2. The most likely market impact scenario (1 paragraph)
3. Historical precedent (what similar events led to)
4. Key dates/triggers to watch
5. Contrarian view — why this might NOT play out

Keep it under 300 words. Be specific about asset price implications. No disclaimers.`;

  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 12_000);

    try {
      const res = await fetch(GEMINI_URL, {
        method: "POST",
        signal: controller.signal,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ role: "user", parts: [{ text: prompt }] }],
          generationConfig: {
            temperature: 0.7,
            maxOutputTokens: 500,
          },
        }),
      });

      if (!res.ok) {
        return Response.json({ ok: false, message: "AI request failed." }, { status: 502 });
      }

      const json = (await res.json()) as any;
      const text =
        json?.candidates?.[0]?.content?.parts?.map((p: any) => p?.text ?? "").join("") ?? "";

      if (!text.trim()) {
        return Response.json({ ok: false, message: "AI returned an empty response." }, { status: 502 });
      }

      return Response.json({ ok: true, analysis: text.trim() });
    } finally {
      clearTimeout(timer);
    }
  } catch {
    return Response.json({ ok: false, message: "AI request timed out." }, { status: 504 });
  }
}
