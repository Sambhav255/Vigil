import { describe, expect, it } from "vitest";
import { evaluateSourceHealth } from "@/lib/degradation/sourceHealth";

describe("degradation policy", () => {
  it("marks stale sources when freshness threshold exceeded", () => {
    const now = Date.now();
    const status = evaluateSourceHealth(
      {
        polymarket: { lastUpdatedMs: now - 20 * 60 * 1000, ok: true },
      },
      now
    );

    expect(status.polymarket.state).toBe("stale");
  });
});
