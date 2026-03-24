# Per-Threat Depth — Design Spec

**Date:** 2026-03-23
**Status:** Approved
**Scope:** Sub-project #2 of the Vigil depth expansion. Adds four-tab depth panel to the existing `DetailPanel` component using only data already in the pipeline — no new external data sources required except one new Gemini endpoint for historical precedent.

---

## Goal

When a user selects a threat, they can go deeper than the current Overview (probability, severity, cascade ETA, assets, AI analysis). Four tabs expose: correlated threats, signal confidence decomposition, probability trend, and AI historical precedent.

---

## Architecture

```
DetailPanel.tsx
├── tab bar: [Overview] [Correlated] [Confidence] [History]
├── tab === "overview"    → existing content (unchanged)
├── tab === "correlated"  → <CorrelatedThreats threat={selected} allThreats={all} />
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
- `app/api/analyze/route.ts` — extract shared rate-limit helper (reused by `/api/precedent`)

---

## Tab Designs

### Overview (unchanged)
Existing content: summary, probability, cascade ETA, severity, assets, Watch Assets button, Analyze button, analysis output. No modifications.

### Correlated Tab — `CorrelatedThreats.tsx`

**Logic:** Filter `allThreats` for threats where:
- `threat.assets` shares ≥1 symbol with `selected.assets`, OR
- `threat.sector === selected.sector`
- AND `threat.id !== selected.id`

Sort by `compositeScore` descending. Cap display at 8 results.

**Render:** Compact rows — severity dot + truncated title + composite score + probability. Each row is clickable and calls `onSelectThreat(threat)` to pivot the panel to that threat.

**Empty state:** `"No correlated threats active."` in `styles.detailBoxSub`.

**Props:**
```typescript
{ threat: Threat; allThreats: Threat[]; onSelectThreat: (t: Threat) => void }
```

### Confidence Tab — `ConfidenceBreakdown.tsx`

Pure computation from fields already on the threat object. No async.

**Rows displayed:**
| Label | Source field | Notes |
|---|---|---|
| Source count | `sourceCount` | Badge: 1=unverified, 2+=corroborated |
| Probability source | `probSource` | Polymarket / Kalshi |
| Confidence tier | `confidence` | low/medium/high + volume threshold that produced it |
| Verified | `verified` | bool — whether dedup merged ≥2 sources |
| Bias correction | `probability` vs raw | Phase 2 favorite-longshot correction direction (up/down arrow) |
| Decay applied | threat age vs half-life | Phase 3: "X% discounted — Yh old, Zh half-life" |
| Composite score | `compositeScore` | Stacked horizontal bar: base × sensitivity × decay |

**Edge case:** If `probHistory.length < 2`, bias correction row shows "Insufficient history."

**Props:**
```typescript
{ threat: Threat }
```

### History Tab — `ThreatHistory.tsx`

Two sections:

**Section 1 — Probability Trend**
Inline SVG line chart (~120px tall) over `probHistory` array. X-axis: relative labels (T-N … Now). Y-axis: 0–100% range. Direction indicator arrow (up/flat/down) based on first vs last value. If `probHistory.length < 2`: render "Not enough data points yet."

No new charting library — SVG path computed from the array directly, same approach as the existing Sparkline.

**Section 2 — Historical Precedent**
"Load Precedent" button → calls `POST /api/precedent` → renders markdown-style text block.

States: idle → loading → result | error.

Prompt sent to Gemini:
> *"You are a geopolitical historian and risk analyst. For the following threat, name 2-3 of the most historically similar events, what happened to the listed assets within 30 days of each event, and what the resolution timeline looked like. Be specific about price direction and magnitude. Under 250 words. No disclaimers."*
> Threat: `[title]`, Assets: `[assets]`, Category: `[category]`, Probability: `[probability]`

Cached in component `useState` per `selected.id`. Cleared on threat change.

**Props:**
```typescript
{ threat: Threat }
```

---

## New API Route — `/api/precedent`

Identical structure to `/api/analyze/route.ts`:
- `export const dynamic = "force-dynamic"`
- 503 if no `GEMINI_API_KEY`
- Separate `lastPrecedentCallAt` variable — 30s rate limit independent of `/api/analyze`
- 12s abort timeout
- Returns `{ ok: boolean; precedent?: string; message?: string }`

Request body: `{ threatTitle, category, assets, probability }`

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

**Tab reset effect** — add `setActiveTab("overview")` to the existing `useEffect` that fires on `selected?.id` change.

**Tab bar** — rendered above the existing content area when `selected` is non-null. Four buttons, active underlined with the severity color of the selected threat.

---

## Styling

All in `VigilDashboard.module.css`:

```css
.tabBar          — flex row, border-b border-zinc-800/50, gap-0
.tabBtn          — 10px mono uppercase, text-zinc-500, px-3 py-2, no background
.tabBtnActive    — text-zinc-200, border-b-2 (color = severity), margin-bottom: -1px
.correlatedRow   — flex, h-8, items-center, gap-2, cursor-pointer, hover:bg-zinc-800/40
.confidenceRow   — flex, justify-between, py-1, text-[11px]
.scoreBar        — h-[3px] rounded-full bg-zinc-800, w-full
.scoreBarFill    — h-[3px] rounded-full, gradient from severity color
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

Covers the correlated filtering logic extracted into a pure function `getCorrelatedThreats(selected, allThreats)`:
- Returns threats sharing ≥1 asset
- Returns threats sharing sector (but not asset)
- Excludes the selected threat itself
- Returns empty array when no matches
- Sorts by compositeScore descending
- Caps at 8 results

The function is exported from `CorrelatedThreats.tsx` (or a shared util) so it can be tested without rendering.

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

Expected: 0 lint errors, all tests pass (including new `correlated.test.ts`), build succeeds.

---

## Out of Scope

- New external data sources (that's sub-project #1)
- Price charts for assets (needs market data feed)
- Persisting precedent results to Convex (that's sub-project #4)
- Mobile layout changes to the tab bar
