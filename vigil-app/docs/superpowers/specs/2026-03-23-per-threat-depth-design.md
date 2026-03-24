# Per-Threat Depth — Design Spec

**Date:** 2026-03-23
**Status:** Approved
**Scope:** Sub-project #2 of the Vigil depth expansion. Adds four-tab depth panel to the existing `DetailPanel` component using only data already in the pipeline — no new external data sources required except one new Gemini endpoint for historical precedent.

---

## Goal

When a user selects a threat, they can go deeper than the current Overview (probability, severity, cascade ETA, assets, AI analysis). Four tabs expose: correlated threats, signal confidence decomposition, probability trend, and AI historical precedent.

---

## Type Import Convention

All new component files import `Threat` from `@/components/dashboard/dashboardTypes` (not from `@/lib/types`). The dashboard type is `Snapshot["threats"][0]` — the pipeline-resolved variant where `compositeScore: number` is always present (non-optional). Using `@/lib/types` would give `compositeScore?: number` (optional) and produce different TypeScript behavior.

---

## Architecture

```
DetailPanel.tsx
├── tab bar: [Overview] [Correlated] [Confidence] [History]
├── tab === "overview"    → existing content (unchanged)
├── tab === "correlated"  → <CorrelatedThreats threat={selected} allThreats={all} onSelectThreat={fn} />
├── tab === "confidence"  → <ConfidenceBreakdown threat={selected} />
└── tab === "history"     → <ThreatHistory threat={selected} />
```

**New files:**
- `components/dashboard/tabs/CorrelatedThreats.tsx`
- `components/dashboard/tabs/ConfidenceBreakdown.tsx`
- `components/dashboard/tabs/ThreatHistory.tsx`
- `app/api/precedent/route.ts`
- `tests/correlated.test.ts`

**Modified files:**
- `components/dashboard/DetailPanel.tsx` — add tab state, tab bar, new props, lazy tab rendering
- `components/VigilDashboard.tsx` — pass `allThreats` and `onSelectThreat` into `DetailPanel`
- `components/VigilDashboard.module.css` — tab bar styles

---

## Tab Designs

### Overview (unchanged)
Existing content: summary, probability, cascade ETA, severity, assets, Watch Assets button, Analyze button, analysis output. No modifications.

### Correlated Tab — `CorrelatedThreats.tsx`

**Logic — `getCorrelatedThreats` (exported pure function):**
```typescript
export function getCorrelatedThreats(selected: Threat, allThreats: Threat[]): Threat[] {
  const selectedAssets = new Set(selected.assets);
  return allThreats
    .filter(t =>
      t.id !== selected.id &&
      (t.assets.some(a => selectedAssets.has(a)) || t.sector === selected.sector)
    )
    .sort((a, b) => (b.compositeScore ?? 0) - (a.compositeScore ?? 0))
    .slice(0, 8);
}
```

Note: `compositeScore` is non-optional on the dashboard `Threat` type, but `?? 0` is used defensively. The filter uses OR — a threat matching both asset and sector appears exactly once (no deduplication needed since `.filter()` visits each threat once).

**Render:** Compact rows — severity dot + truncated title + composite score + probability. Each row is clickable and calls `onSelectThreat(threat)`.

**Empty state:** `"No correlated threats active."` in `styles.detailBoxSub`.

**Props:**
```typescript
{ threat: Threat; allThreats: Threat[]; onSelectThreat: (t: Threat) => void }
```

### Confidence Tab — `ConfidenceBreakdown.tsx`

Pure computation from fields on the threat object. No async.

**Rows displayed:**

| Label | Source | Notes |
|---|---|---|
| Source count | `sourceCount` | Badge: 1 = unverified, 2+ = corroborated |
| Probability source | `probSource` | Polymarket / Kalshi |
| Confidence tier | `confidence` | low / medium / high — with the volume thresholds: high > 100k, medium ≥ 10k, low < 10k |
| Verified | `verified` | bool — true when dedup merged ≥2 sources |
| Bias correction | `probability` direction | Phase 2 favorite-longshot correction: show up/down arrow based on `probability > 0.5` (longshot boosted) vs `probability < 0.5` (favorite discounted). Always renderable — no guard needed. |
| Decay applied | threat age | Phase 3: compute `ageHours = (Date.now() - threat.createdAt) / 3_600_000`. Display as `"Xh old — bearish events decay at 21h half-life, bullish at 14h"` using the direction field. Do NOT attempt to reverse-engineer the exact decay factor from compositeScore; just show age + the known half-life constants from pipeline (21h bearish, 14h bullish). |
| Composite score | `compositeScore` | Horizontal bar: `width = compositeScore / 100 * 100%`. Use `compositeScore ?? 0` defensively. Gradient fill from severity color. |

**Props:**
```typescript
{ threat: Threat }
```

### History Tab — `ThreatHistory.tsx`

Two sections:

**Section 1 — Probability Trend**
Inline SVG line chart (~120px tall) over `probHistory` array.
- Guard: `if (probHistory.length < 2)` → render `"Not enough data points yet"` (this also guards against the divide-by-zero when computing x-step as `width / (length - 1)`).
- X-axis: relative labels (T-N … Now). Y-axis: 0–1 range mapped to chart height.
- Direction indicator arrow (↑/→/↓) based on `first` vs `last` value.
- No new charting library — SVG `<path>` computed directly, same approach as the existing `Sparkline` in `DetailPanel.tsx`.

**Section 2 — Historical Precedent**
"Load Precedent" button → calls `POST /api/precedent` → renders text block.

States: idle → loading → result | error.

Prompt sent to Gemini:
> *"You are a geopolitical historian and risk analyst. For the following threat, name 2-3 of the most historically similar events, what happened to the listed assets within 30 days of each event, and what the resolution timeline looked like. Be specific about price direction and magnitude. Under 250 words. No disclaimers."*
> Threat: `[title]`, Assets: `[assets]`, Category: `[category]`, Probability: `[probability]`

Cached in component `useState`. Cleared via `useEffect` on `selected?.id` change (this effect also fires when `selected` becomes `null`, since `undefined !== previousId` — that's correct and intentional).

**Props:**
```typescript
{ threat: Threat }
```

---

## New API Route — `/api/precedent`

Identical structure to `/api/analyze/route.ts`:
- `export const dynamic = "force-dynamic"`
- 503 if no `GEMINI_API_KEY` → `{ ok: false, message: "AI unavailable — set GEMINI_API_KEY to enable" }`
- Separate module-level `let lastPrecedentCallAt = 0` — 30s rate limit **independent** of the `lastGeminiCallAt` in `/api/analyze`. Neither blocks the other.
- 12s abort timeout → 504
- Returns `{ ok: boolean; precedent?: string; message?: string }`

Request body type:
```typescript
type PrecedentRequestBody = {
  threatTitle?: string;
  category?: string;
  assets?: string[];
  probability?: number;
}
```

---

## DetailPanel Changes

**New props:**
```typescript
allThreats: Threat[]
onSelectThreat: (t: Threat) => void
```

**New state:**
```typescript
const [activeTab, setActiveTab] = useState<"overview" | "correlated" | "confidence" | "history">("overview")
```

**Tab reset effect** — add `setActiveTab("overview")` to the existing `useEffect([selected?.id])`. This effect fires on any `id` change AND when `selected` transitions to `null` (undefined !== previous id), so the tab always resets on close or selection change.

**Tab bar** — rendered when `selected` is non-null. Four buttons. Active tab uses `.tabBtnActive` CSS class for layout, **plus an inline `style={{ borderBottomColor: SEVERITY_COLOR[selected.severity] }}`** for the dynamic severity color. Static CSS cannot express a per-threat runtime color value.

---

## Styling

All in `VigilDashboard.module.css`:

```css
.tabBar        — display: flex, border-bottom: 1px solid var(--border), gap: 0, margin-bottom: 8px
.tabBtn        — font-family: var(--font-mono), font-size: 10px, text-transform: uppercase,
                 color: var(--text-muted), padding: 6px 12px, background: none, border: none,
                 border-bottom: 2px solid transparent, margin-bottom: -1px, cursor: pointer
.tabBtnActive  — color: var(--text-primary), border-bottom: 2px solid currentColor
                 (color overridden by inline style — see DetailPanel tab bar note above)
.correlatedRow — display: flex, height: 32px, align-items: center, gap: 8px,
                 cursor: pointer, padding: 0 4px, border-radius: 4px
                 hover: background: rgba(255,255,255,0.04)
.confidenceRow — display: flex, justify-content: space-between, padding: 3px 0, font-size: 11px
.scoreBar      — height: 3px, border-radius: 9999px, background: var(--border), width: 100%
.scoreBarFill  — height: 3px, border-radius: 9999px, gradient from severity color (inline style)
```

---

## VigilDashboard.tsx Changes

Pass two new props into `<DetailPanel>`:
```tsx
<DetailPanel
  ...existing props...
  allThreats={data?.threats ?? []}
  onSelectThreat={setSelected}
/>
```

---

## Testing

**New file: `tests/correlated.test.ts`**

Tests the exported pure function `getCorrelatedThreats(selected, allThreats)`:

1. Returns threats sharing ≥1 asset with selected
2. Returns threats sharing sector (but not asset) with selected
3. Excludes the selected threat itself
4. Returns empty array when no matches
5. Sorts by `compositeScore` descending
6. Caps at 8 results when >8 matches exist
7. **Deduplication:** A threat matching on BOTH asset AND sector appears exactly once (not twice)

The function is exported from `CorrelatedThreats.tsx` and tested without rendering.

---

## Verification Gates

After each implementation phase:
```bash
npm run lint && npm run test:run
```

After all phases:
```bash
npm run build
```

Expected: 0 lint errors, all tests pass (7 correlated tests + 19 existing), build succeeds.

---

## Out of Scope

- New external data sources (sub-project #1)
- Price charts for assets (needs market data feed)
- Persisting precedent results to Convex (sub-project #4)
- Mobile layout changes to the tab bar
