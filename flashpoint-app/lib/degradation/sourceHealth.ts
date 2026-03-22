import { SOURCE_STALE_AFTER_MS } from "@/lib/config/constants";
import type { SourceHealth, SourceSnapshot } from "@/lib/types";

export function evaluateSourceHealth(sources: Record<string, SourceSnapshot>, nowMs: number): Record<string, SourceHealth> {
  const out: Record<string, SourceHealth> = {};
  Object.entries(sources).forEach(([name, source]) => {
    const ageMs = nowMs - source.lastUpdatedMs;
    if (!source.ok) {
      out[name] = { state: "offline", label: "offline", lastUpdatedMs: source.lastUpdatedMs };
      return;
    }
    if (ageMs > SOURCE_STALE_AFTER_MS) {
      out[name] = { state: "stale", label: "stale", lastUpdatedMs: source.lastUpdatedMs };
      return;
    }
    out[name] = { state: "live", label: "live", lastUpdatedMs: source.lastUpdatedMs };
  });
  return out;
}
