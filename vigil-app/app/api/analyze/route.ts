import { NextResponse } from "next/server";

export const runtime = "nodejs";

const GROQ_MODEL = process.env.GROQ_MODEL ?? "openai/gpt-oss-120b";

export async function POST(req: Request) {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { ok: false, message: "Missing GROQ_API_KEY in environment." },
      { status: 503 },
    );
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, message: "Invalid JSON body." }, { status: 400 });
  }

  const b = body as Record<string, unknown>;
  const threatTitle = typeof b.threatTitle === "string" ? b.threatTitle : "";
  const category = typeof b.category === "string" ? b.category : "";
  const severity = typeof b.severity === "string" ? b.severity : "";
  const assets = Array.isArray(b.assets) ? b.assets.filter((x) => typeof x === "string") : [];
  const probability =
    typeof b.probability === "number" && Number.isFinite(b.probability) ? b.probability : 0;

  const prompt = `You are Vigil, a geopolitical risk analyst for traders.

Threat: ${threatTitle}
Category: ${category}
Severity: ${severity}
Affected assets: ${assets.join(", ") || "n/a"}
Market-implied probability: ${(probability * 100).toFixed(0)}%

Give a concise analysis (max 180 words) with:
1) What is happening (2-3 sentences)
2) Key second-order effects on listed assets
3) What could invalidate this read

Plain text only, no markdown.`;

  try {
    const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: GROQ_MODEL,
        messages: [{ role: "user", content: prompt }],
        temperature: 0.4,
        max_tokens: 400,
      }),
    });

    const json = (await res.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
      error?: { message?: string };
    };

    if (!res.ok) {
      const msg = json.error?.message ?? `Groq error (${res.status})`;
      return NextResponse.json({ ok: false, message: msg }, { status: 502 });
    }

    const text = json.choices?.[0]?.message?.content?.trim() ?? "";
    if (!text) {
      return NextResponse.json({ ok: false, message: "Empty response from Groq." }, { status: 502 });
    }

    return NextResponse.json({ ok: true, analysis: text });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Unknown error";
    return NextResponse.json({ ok: false, message: msg }, { status: 500 });
  }
}
