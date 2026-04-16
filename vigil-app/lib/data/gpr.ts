import { logSourceFailure } from "@/lib/logging/sourceLogger";
const GPR_URL = "https://www.matteoiacoviello.com/gpr_files/data_gpr_daily_recent.xls";
const CACHE_MS = 24 * 60 * 60 * 1000; // 24h
const FALLBACK_VALUE = 120;

let cache: { fetchedAt: number; value: number } | null = null;

function parseLatestValue(text: string): number | null {
  const lines = text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);

  if (lines.length === 0) return null;

  // This feed is described as TSV in practice, despite ".xls" extension.
  const lastLine = lines[lines.length - 1];
  const parts = lastLine.split(/\t|,/);

  // Robust parsing: pick the last parseable numeric value.
  const nums = parts
    .map((p) => parseFloat(p.replace(/,/g, "")))
    .filter((n) => !Number.isNaN(n));

  if (nums.length === 0) return null;
  return nums[nums.length - 1];
}

export async function fetchGprIndex(): Promise<number> {
  const now = Date.now();
  if (cache && now - cache.fetchedAt < CACHE_MS) return cache.value;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 4_000);
  try {
    const res = await fetch(GPR_URL, { cache: "no-store", signal: controller.signal });
    if (!res.ok) return FALLBACK_VALUE;
    const text = await res.text();
    const value = parseLatestValue(text);
    const out = value ?? FALLBACK_VALUE;
    cache = { fetchedAt: now, value: out };
    return out;
  } catch {
    logSourceFailure("gpr", "fetchGprIndex failed or timed out");
    return FALLBACK_VALUE;
  } finally {
    clearTimeout(timer);
  }
}

