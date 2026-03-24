# Vigil Cleanup & Feature Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remove dead code, wire up the Analyze button, fix hit-rate panel, verify styling, add test coverage, add keyboard shortcut hint and Watch confirmation, then verify lint/tests/build pass.

**Architecture:** Six phases of focused, mostly-independent edits to existing components and one new test file. No new dependencies. All changes are isolated to `components/`, one test file, and verification runs.

**Tech Stack:** Next.js 16, React 18, TypeScript strict, CSS Modules, Tailwind CSS 4, Vitest

**IMPORTANT RULES (from Instructions.md):**
- Run `npm run lint && npm run test:run` after every phase. Fix all errors before continuing.
- TypeScript strict mode — no `any`, no `@ts-ignore`.
- Do NOT change functionality, data sources, or API logic.
- Do NOT alter the dark theme or color system.
- Do NOT touch `convex/` files.

All commands run from `vigil-app/`.

---

## File Map

| File | Action |
|------|--------|
| `components/VigilDashboard.tsx` | Delete two `display:none` dead-code blocks; remove dead local helpers |
| `components/dashboard/DetailPanel.tsx` | Wire Analyze button; add Watch confirmation state |
| `components/dashboard/RightPanel.tsx` | Fix hit-rate panel for sampleSize=0 and <10 |
| `components/dashboard/FilterBar.tsx` | Add keyboard shortcut hint |
| `components/VigilDashboard.module.css` | Verify styling specs (no changes expected) |
| `tests/dedup.test.ts` | Create new test file |

---

## Task 1: Remove dead-code block #1 in VigilDashboard.tsx (inline portfolio grid)

**Files:**
- Modify: `components/VigilDashboard.tsx` (~lines 822–982)

Context: After `<PortfolioView .../>`, there is a `<div style={{ display: "none" }}>` block that contains the old inline portfolio grid. It wraps everything from the `Portfolio Monitor` section header through the old portfolio card grid. Delete it entirely.

- [ ] **Step 1: Locate and delete dead block #1**

In `components/VigilDashboard.tsx`, find and delete the block starting with:
```tsx
                <div style={{ display: "none" }}>
                  <div className={styles.sectionHeader}>Portfolio Monitor</div>
```
...and ending with its closing `</div>` (just before the `</>` that closes the portfolio branch). This entire block is wrapped in `display: none`.

After deletion, the portfolio branch should look like:
```tsx
            {view === "portfolio" ? (
              /* ── Portfolio Panel ── */
              <>
                <PortfolioView
                  ...
                />
              </>
            ) : (
              <SectorHeatmap ... />
            )}
```

- [ ] **Step 2: Verify file compiles**

```bash
npx tsc --noEmit
```
Expected: no errors on this file (there may be others from later phases — ignore those for now).

---

## Task 2: Remove dead-code block #2 in VigilDashboard.tsx (duplicate detail panel)

**Files:**
- Modify: `components/VigilDashboard.tsx` (~lines 993–1178)

Context: After the `<DetailPanel>` component usage, there are two hidden elements:
1. A `<div className={styles.sectionHeader} style={{ ..., display: "none" }}>Threat Detail</div>` — the old inline section header
2. A `<div className={styles.detailPanel} style={{ display: "none" }}>` block — the old duplicate inline detail panel

Delete both.

- [ ] **Step 1: Delete the hidden section header**

Find and delete:
```tsx
            {/* Threat detail — always visible in center column */}
            <div
              className={styles.sectionHeader}
              style={{ marginTop: view === "portfolio" ? 14 : 0, display: "none" }}
            >
              Threat Detail
            </div>
```

- [ ] **Step 2: Delete the hidden detail panel**

Find and delete the block:
```tsx
            <div className={styles.detailPanel} style={{ display: "none" }}>
              ...
            </div>
```
This block spans from `display: "none"` through its closing `</div>`, ending just before `</div>` that closes `colCenter`.

After both deletions, the center column ends with:
```tsx
            <DetailPanel
              view={view}
              selected={selected}
              portfolio={portfolio}
              onClose={() => setSelected(null)}
              addToPortfolio={addToPortfolio}
            />
            </div>
          </div>
          </ErrorBoundary>
```

---

## Task 3: Remove unused local helpers from VigilDashboard.tsx

**Files:**
- Modify: `components/VigilDashboard.tsx` (~lines 27–193)

Context: After removing the dead code blocks in Tasks 1-2, the following local definitions become completely unused. Confirmed by grep: `scoreClass` and `SOURCE_DISPLAY` appear only as definitions, never used outside dead blocks. Delete them all:

- `SEVERITY_COLOR` constant (lines ~27–32) — was only used in dead code and local `scoreHex`
- `SEV_CARD` constant (~34–39) — was only used in dead detail panel
- `SEV_BADGE` constant (~41–46) — was only used in dead detail panel
- `SEV_SELECTED` constant (~48–53) — was only used in dead detail panel
- `SOURCE_DISPLAY` constant (~79–90) — duplicate of shared.ts export; only used in dead blocks / now-removed code
- `fmtPrice` function — now unused (was in dead blocks)
- `fmtVol` function — now unused (was in dead blocks)
- `scoreClass` function — now unused (was in dead blocks); not in shared.ts but not needed anywhere
- `scoreHex` function — now unused (was in dead blocks)
- `probDeltaClass` function — now unused (was in dead blocks)
- `truncateTitle` function — now unused (was in dead blocks)
- `Sparkline` component — was only used at line ~1062 which is in dead block #2
- `getSourceDisplay` function — now in RightPanel.tsx, unused in VigilDashboard

Also remove the now-unused top-level import `type { CSSProperties }` if it was only used in these deleted sections. (Keep `type CSSWithCustomProperties` which is still used in the skeleton heatmap cells.)

- [ ] **Step 1: Pre-deletion verification**

Before deleting, run:
```bash
grep -n "scoreClass\|SOURCE_DISPLAY\|probDeltaClass\|getSourceDisplay\|fmtPrice\|fmtVol\|truncateTitle\|scoreHex\|Sparkline" components/VigilDashboard.tsx
```
Confirm each name appears only in its definition line (and in the dead blocks you're about to delete). If any appears in live render code, do NOT delete it — instead import it from `./dashboard/shared` and remove only the local definition.

- [ ] **Step 2: Delete unused constants (SEVERITY_COLOR, SEV_CARD, SEV_BADGE, SEV_SELECTED, SOURCE_DISPLAY)**

Find the blocks at lines ~27–90 and delete all five constants.

- [ ] **Step 3: Delete unused helper functions**

Delete the function bodies for: `fmtPrice`, `fmtVol`, `scoreClass`, `scoreHex`, `probDeltaClass`, `truncateTitle`, `Sparkline`, `getSourceDisplay`.

- [ ] **Step 4: Run lint + tests**

```bash
npm run lint && npm run test:run
```
Expected: lint passes; all existing tests pass (scoring, phase2phase3, degradation, pipeline, alphaSectorMapping).

---

## Task 4: Wire up Analyze button in DetailPanel.tsx

**Files:**
- Modify: `components/dashboard/DetailPanel.tsx`

Context: The `⚡ Analyze` button currently has no `onClick`. We need to add state, a handler, a clear-on-change effect, update the button, and display the result/error.

- [ ] **Step 1: Add imports**

Add at top of file (these are already available in React):
```tsx
import { useCallback, useEffect, useState } from "react";
```
(Replace the existing `import { useMemo } from "react"` — add the new imports alongside it.)

- [ ] **Step 2: Add state inside the component**

Inside `DetailPanel` function body, after the existing `useMemo` line, add:
```tsx
  const [analyzing, setAnalyzing] = useState(false);
  const [analysis, setAnalysis] = useState<string | null>(null);
  const [analyzeError, setAnalyzeError] = useState<string | null>(null);
```

- [ ] **Step 3: Add the handleAnalyze callback**

```tsx
  const handleAnalyze = useCallback(async () => {
    if (!selected || analyzing) return;
    setAnalyzing(true);
    setAnalysis(null);
    setAnalyzeError(null);
    try {
      const res = await fetch('/api/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          threatTitle: selected.title,
          category: selected.category,
          severity: selected.severity,
          assets: selected.assets,
          probability: selected.probability,
        }),
      });
      if (res.status === 503) {
        setAnalyzeError('AI unavailable — set GEMINI_API_KEY to enable');
        return;
      }
      const json = await res.json() as { ok: boolean; analysis?: string; message?: string };
      if (json.ok && json.analysis) {
        setAnalysis(json.analysis);
      } else {
        setAnalyzeError(json.message ?? 'Analysis failed');
      }
    } catch {
      setAnalyzeError('Network error');
    } finally {
      setAnalyzing(false);
    }
  }, [selected, analyzing]);
```

- [ ] **Step 4: Add clear-on-change effect**

```tsx
  useEffect(() => {
    setAnalysis(null);
    setAnalyzeError(null);
  }, [selected?.id]);
```

- [ ] **Step 5: Update the Analyze button**

Replace:
```tsx
                <button type="button" className={styles.analyzeBtn}>
                  ⚡ Analyze
                </button>
```
With:
```tsx
                <button
                  type="button"
                  className={styles.analyzeBtn}
                  onClick={handleAnalyze}
                  disabled={analyzing}
                >
                  ⚡ {analyzing ? 'Analyzing…' : 'Analyze'}
                </button>
```

- [ ] **Step 6: Show analysis output / error below detailFooter**

After the closing `</div>` of `detailFooter`, add:
```tsx
            {analysis && (
              <div
                className={styles.detailSummary}
                style={{ borderLeftColor: '#6366f14d', marginTop: 10 }}
              >
                {analysis}
              </div>
            )}
            {analyzeError && (
              <div style={{ fontSize: 10, color: '#c42626', marginTop: 8 }}>
                {analyzeError}
              </div>
            )}
```

- [ ] **Step 7: Run lint + tests**

```bash
npm run lint && npm run test:run
```
Expected: all pass. If lint warns about `useEffect` missing dep on `selected?.id` — that pattern is intentional (we use the optional-chained primitive), it's fine.

---

## Task 5: Add Watch Assets confirmation in DetailPanel.tsx

**Files:**
- Modify: `components/dashboard/DetailPanel.tsx`

Context: The `+ Watch Assets` button should briefly show "Added ✓" for 1.5s after clicking.

- [ ] **Step 1: Add watchAdded state**

Add alongside the other state declarations:
```tsx
  const [watchAdded, setWatchAdded] = useState(false);
```

- [ ] **Step 2: Add reset-on-selected-change to the existing useEffect**

Update the existing `useEffect` that clears analysis on selected change to also reset `watchAdded`:
```tsx
  useEffect(() => {
    setAnalysis(null);
    setAnalyzeError(null);
    setWatchAdded(false);
  }, [selected?.id]);
```

- [ ] **Step 3: Update Watch Assets button**

Replace:
```tsx
                <button
                  type="button"
                  className={styles.analyzeBtn}
                  onClick={() => selected.assets.forEach(addToPortfolio)}
                  title="Add all affected assets to portfolio"
                >
                  + Watch Assets
                </button>
```
With:
```tsx
                <button
                  type="button"
                  className={styles.analyzeBtn}
                  onClick={() => {
                    selected.assets.forEach(addToPortfolio);
                    setWatchAdded(true);
                    setTimeout(() => setWatchAdded(false), 1500);
                  }}
                  title="Add all affected assets to portfolio"
                >
                  {watchAdded ? 'Added ✓' : '+ Watch Assets'}
                </button>
```

---

## Task 6: Fix hit-rate panel initialization in RightPanel.tsx

**Files:**
- Modify: `components/dashboard/RightPanel.tsx`

Context: When `sampleSize === 0`, the bar renders at zero width and looks broken. When `sampleSize < 10`, it should note "(limited sample)".

- [ ] **Step 1: Update the Signal Hit Rate section**

Find the existing Signal Hit Rate `<div className={styles.rightSection}>` block and replace its content:

Replace the entire inner `<div className={styles.forceItem}>` block (the one showing hit rate) with:
```tsx
        <div className={styles.forceItem}>
          {hitRate && hitRate.sampleSize === 0 ? (
            <div className={styles.detailBoxSub}>
              Insufficient data · signals accumulate after first run
            </div>
          ) : (
            <>
              <div className={styles.forceHeader}>
                <span className={styles.forceName}>Estimated 30d quality</span>
                <span className={styles.forceScore}>
                  {hitRate ? (
                    <>
                      {hitRate.hitRate}%
                      {hitRate.sampleSize > 0 && hitRate.sampleSize < 10 && (
                        <span style={{ fontSize: 9, color: 'var(--text-muted)', marginLeft: 4 }}>
                          (limited sample)
                        </span>
                      )}
                    </>
                  ) : '—'}
                </span>
              </div>
              <div className={styles.forceBar}>
                <div
                  className={styles.forceBarFill}
                  style={{
                    width: `${Math.max(0, Math.min(100, hitRate?.hitRate ?? 0))}%`,
                    background: scoreHex(hitRate?.hitRate ?? 0),
                  }}
                />
              </div>
              <div className={styles.detailBoxSub}>
                {hitRate ? `${hitRate.sampleSize} alerts sampled` : 'No local hit-rate log available'}
              </div>
            </>
          )}
        </div>
```

- [ ] **Step 2: Run lint + tests**

```bash
npm run lint && npm run test:run
```
Expected: all pass.

---

## Task 7: Add keyboard shortcut hint in FilterBar.tsx

**Files:**
- Modify: `components/dashboard/FilterBar.tsx`

Context: Add a small static hint string at the far right of the `filterRight` div showing keyboard shortcuts.

- [ ] **Step 1: Add the hint span inside filterRight**

Find the `<div className={styles.filterRight}>` block. Add a hint `<span>` as the last child:
```tsx
      <div className={styles.filterRight}>
        <button type="button" className={styles.filterNotifyBtn} onClick={onToggleNotifications}>
          {notificationsEnabled ? "🔔 Alerts On" : "🔕 Alerts Off"}
        </button>
        <span className={styles.liveDot} />
        <span>LIVE</span>
        <span>{timeStr}</span>
        <span>
          {view === "portfolio" && portfolioLength
            ? `${portfolioThreatsCount} THREATS`
            : `${viewThreatCount} THREATS`}
        </span>
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--text-muted)', letterSpacing: '0.05em' }}>
          [j/k] [Enter] [Esc] [/] [p] [1-4]
        </span>
      </div>
```

- [ ] **Step 2: Run lint + tests**

```bash
npm run lint && npm run test:run
```
Expected: all pass.

---

## Task 8: Verify CSS styling specs (Phase 3)

**Files:**
- Read: `components/VigilDashboard.module.css`

This task is verification only. Based on codebase inspection, all specs are already implemented. Confirm each:

- [ ] **Step 1: Verify sectionHeader::before**

Check that `.sectionHeader` has `display: flex` and `.sectionHeader::before` has `content: ''`, `width: 2px`, `height: 9px`, and a background. Confirmed at lines 372–393. No change needed.

- [ ] **Step 2: Verify heatmap cell glow**

Check `SectorHeatmap.tsx` passes `"--cell-glow": \`${hex}0a\`` for non-selected cells. Confirmed at line 30. No change needed.

- [ ] **Step 3: Verify probability bar gradients and probRankBarFill**

Check CSS for `.probBarPolymarket` and `.probBarKalshi`. Confirmed at lines 568–573 with correct `linear-gradient` values.

Also verify `RightPanel.tsx` applies these classes correctly to `.probRankBarFill`. In `RightPanel.tsx`, confirm the bar element uses:
```tsx
className={`${styles.probRankBarFill} ${
  t.probSource === "Polymarket" ? styles.probBarPolymarket : styles.probBarKalshi
}`}
```
This is confirmed at lines ~59–63 of RightPanel.tsx. No change needed.

- [ ] **Step 4: Verify selected card tints**

Check `.selectedCritical`, `.selectedHigh`, `.selectedMedium`, `.selectedLow` CSS classes. Confirmed at lines 434–453 with correct rgba values. No change needed.

---

## Task 9: Add dedup.test.ts

**Files:**
- Create: `tests/dedup.test.ts`

- [ ] **Step 1: Create the test file**

Create `tests/dedup.test.ts` with exactly this content (from Instructions.md):

```typescript
import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/data/sources", () => ({
  getDashboardData: vi.fn(async () => ({
    gprIndex: 100,
    tickers: [],
    sectors: [],
    forces: [
      { name: "Geopolitical", weight: 0.35, score: 50 },
      { name: "Macro", weight: 0.25, score: 50 },
      { name: "Sentiment", weight: 0.2, score: 50 },
      { name: "Supply Chain", weight: 0.12, score: 50 },
      { name: "Climate", weight: 0.08, score: 50 },
    ],
    sourceSnapshots: Object.fromEntries(
      ["polymarket","kalshi","gdelt","alphaVantage","coinGecko","usgs","nasaEonet","fred","gprIndex","geminiFlash"]
        .map(k => [k, { lastUpdatedMs: Date.now(), ok: true }])
    ),
    threats: [
      {
        id: 1, title: "Fed rate decision imminent",
        category: "Macroeconomic", severity: "high" as const,
        createdAt: Date.now(), assets: ["SPY"], direction: "bearish" as const,
        probability: 0.5, probSource: "Kalshi" as const, probDelta: 0,
        confidence: "high" as const, volume: 50000, cascadeEta: "1 week",
        momentum: "escalating" as const, summary: "x", sector: "Finance",
        verified: true, sourceCount: 2, probHistory: [0.5],
      },
      {
        id: 2, title: "Hurricane approaching Gulf Coast refineries",
        category: "Climate", severity: "medium" as const,
        createdAt: Date.now(), assets: ["CL"], direction: "bearish" as const,
        probability: 0.8, probSource: "Kalshi" as const, probDelta: 0,
        confidence: "high" as const, volume: 100000, cascadeEta: "2 days",
        momentum: "escalating" as const, summary: "y", sector: "Energy",
        verified: true, sourceCount: 3, probHistory: [0.8],
      },
      {
        id: 3, title: "Bitcoin ETF outflows signal bearish trend",
        category: "Sentiment", severity: "low" as const,
        createdAt: Date.now(), assets: ["BTC"], direction: "bearish" as const,
        probability: 0.3, probSource: "Polymarket" as const, probDelta: 0,
        confidence: "low" as const, volume: 5000, cascadeEta: "3 days",
        momentum: "fading" as const, summary: "z", sector: "Crypto",
        verified: false, sourceCount: 1, probHistory: [0.3],
      },
    ],
  })),
}));

describe("pipeline deduplication", () => {
  it("does not merge dissimilar threats", async () => {
    const { buildDashboardSnapshot } = await import("@/lib/pipeline");
    const snapshot = await buildDashboardSnapshot();
    expect(snapshot.threats.length).toBe(3);
  });

  it("global risk index is between 0 and 100", async () => {
    const { buildDashboardSnapshot } = await import("@/lib/pipeline");
    const snapshot = await buildDashboardSnapshot();
    expect(snapshot.globalRisk).toBeGreaterThan(0);
    expect(snapshot.globalRisk).toBeLessThanOrEqual(100);
  });

  it("all threats have compositeScore defined", async () => {
    const { buildDashboardSnapshot } = await import("@/lib/pipeline");
    const snapshot = await buildDashboardSnapshot();
    for (const t of snapshot.threats) {
      expect(t.compositeScore).toBeDefined();
      expect(t.compositeScore).toBeGreaterThanOrEqual(0);
    }
  });
});
```

- [ ] **Step 2: Run new test file only**

```bash
npx vitest run tests/dedup.test.ts
```
Expected: 3 tests pass.

- [ ] **Step 3: Run full test suite**

```bash
npm run test:run
```
Expected: all 6 test files pass (scoring, phase2phase3, degradation, pipeline, alphaSectorMapping, dedup).

---

## Task 10: Final verification — lint, tests, build

**Files:**
- Check: all modified files

- [ ] **Step 1: Full lint**

```bash
npm run lint
```
Expected: 0 errors, 0 warnings. Common issues to watch:
- `no-unused-vars` on anything left over in VigilDashboard.tsx
- Hook dependency arrays in DetailPanel.tsx
- `@typescript-eslint/no-explicit-any` — all fetch response types must use proper interfaces

- [ ] **Step 2: Full test suite**

```bash
npm run test:run
```
Expected: all 6 test files pass.

- [ ] **Step 3: Production build**

```bash
npm run build
```
Expected: zero errors. Common issues:
- If a server component imports a client hook → add `"use client"` directive
- If `app/api/analyze/route.ts` has dynamic import issue → ensure `export const dynamic = "force-dynamic"` is present
- Verify `.env.example` documents all env vars: `ALPHA_VANTAGE_API_KEY`, `COINGECKO_DEMO_API_KEY`, `FRED_API_KEY`, `GEMINI_API_KEY`, `NEXT_PUBLIC_CONVEX_URL`
- **CSS module path**: All `components/dashboard/*.tsx` files import `./VigilDashboard.module.css` (relative to `components/dashboard/`), but the actual file lives at `components/VigilDashboard.module.css`. If the build fails on missing CSS module, fix these imports to `../VigilDashboard.module.css` in all affected dashboard sub-components.

- [ ] **Step 4: Report final state**

Report: tests passing count, lint error count, build success/fail, summary of what changed in each phase.
