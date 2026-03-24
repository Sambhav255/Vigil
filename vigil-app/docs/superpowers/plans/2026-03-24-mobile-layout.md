# Mobile Layout Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a fixed bottom tab bar on mobile (≤768px) with Feed / Detail / Intel tabs so the dashboard is fully usable on a phone without excessive scrolling.

**Architecture:** `mobileTab` state in `VigilDashboard.tsx` drives which column is visible via a `.mobileHidden` CSS utility class. The tab bar is a `<nav>` element added after the columns div. `DetailPanel` is extracted out of `colCenter` into its own plain wrapper div so it can be shown/hidden independently. Desktop layout is 100% unchanged — the tab bar is `display:none` above 768px and `.mobileHidden` is a no-op outside the media query.

**Tech Stack:** Next.js 16, React 18, TypeScript strict, CSS Modules

**Spec:** `docs/superpowers/specs/2026-03-24-mobile-layout-design.md`

**Task order:** CSS first (Tasks 1–2), then JSX (Tasks 3–5), then FilterBar (Task 6), then verification (Task 7). CSS must exist before JSX references the classes or TypeScript/lint will fail.

---

## File Map

| File | Change |
|---|---|
| `components/VigilDashboard.module.css` | Append new tab bar + utility classes; amend existing `@media (max-width: 768px)` block in-place |
| `components/VigilDashboard.tsx` | Add `mobileTab` state; update `handleThreatClick` + `onClose`; add poll-deselect `useEffect`; restructure columns JSX (conditional classes, extract `DetailPanel` from `colCenter`, wrap `RightPanel`); add tab bar `<nav>` |
| `components/dashboard/FilterBar.tsx` | Add `className={styles.mobileHideHint}` to shortcut hint `<span>` |

No new files. No API changes. No new dependencies.

---

## Task 1: Add new CSS classes (append to end of file)

**Files:**
- Modify: `components/VigilDashboard.module.css` (append after line 1495)

- [ ] **Step 1: Append new classes at the end of the file**

```css
/* ── Mobile tab bar ─────────────────────────────────────────────── */
.mobileTabBar {
  display: none;
}

.mobileTabBtn {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 3px;
  background: none;
  border: none;
  border-top: 2px solid transparent;
  color: var(--text-muted);
  cursor: pointer;
  padding: 6px 0;
  position: relative;
}

.mobileTabBtnActive {
  color: var(--text-primary);
  border-top-color: var(--sev-critical);
}

.mobileTabIcon {
  font-size: 14px;
  line-height: 1;
}

.mobileTabLabel {
  font-family: var(--font-mono);
  font-size: 9px;
  text-transform: uppercase;
  letter-spacing: 0.08em;
}

.mobileTabDot {
  position: absolute;
  top: 6px;
  right: calc(50% - 14px);
  width: 5px;
  height: 5px;
  border-radius: 50%;
  background: var(--sev-critical);
}

.mobileHidden {
  /* no-op on desktop; overridden to display:none inside 768px media query */
}
```

- [ ] **Step 2: Lint check**

```bash
cd vigil-app && npm run lint
```
Expected: 0 errors.

- [ ] **Step 3: Commit**

```bash
git add vigil-app/components/VigilDashboard.module.css
git commit -m "feat(mobile): add tab bar and mobileHidden CSS classes"
```

---

## Task 2: Amend existing `@media (max-width: 768px)` block

**Files:**
- Modify: `components/VigilDashboard.module.css` (edit the existing block starting at line ~1428)

**Important:** Amend the existing block in-place. Do NOT add a second `@media (max-width: 768px)` block.

- [ ] **Step 1: Replace `.metricRow` rule inside the 768px block**

Find (lines ~1439–1442):
```css
.metricRow {
  grid-template-columns: 1fr;
  padding: 8px 10px;
}
```

Replace with:
```css
.metricRow {
  display: flex;
  overflow-x: auto;
  gap: 8px;
  padding: 8px 10px;
  scrollbar-width: none;
  -ms-overflow-style: none;
}
.metricRow::-webkit-scrollbar {
  display: none;
}
```

- [ ] **Step 2: Add `.metricCard` rule after the metricRow block**

```css
.metricCard {
  min-width: 130px;
  flex-shrink: 0;
}
```

- [ ] **Step 3: Amend the `.shell` rule to add bottom padding**

Find (lines ~1429–1433):
```css
.shell {
  height: auto;
  min-height: 100vh;
  overflow: auto;
}
```

Replace with:
```css
.shell {
  height: auto;
  min-height: 100vh;
  overflow: auto;
  padding-bottom: 56px;
}
```

- [ ] **Step 4: Amend `.colLeft, .colCenter, .colRight` rule to add height resets**

Find (lines ~1475–1482):
```css
.colLeft,
.colCenter,
.colRight {
  border-right: none;
  border-top: 1px solid var(--border);
  overflow: visible;
  padding: 10px;
}
```

Replace with:
```css
.colLeft,
.colCenter,
.colRight {
  border-right: none;
  border-top: 1px solid var(--border);
  overflow: visible;
  padding: 10px;
  height: auto;
  min-height: unset;
}
```

- [ ] **Step 5: Add tab bar + utility rules before the closing `}` of the 768px block**

```css
/* tab bar visible on mobile */
.mobileTabBar {
  display: flex;
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;
  height: 56px;
  background: var(--bg-panel);
  border-top: 1px solid var(--border);
  z-index: 100;
}

/* hidden utility active on mobile */
.mobileHidden {
  display: none !important;
}

/* hide keyboard shortcut hint (irrelevant on touch) */
.mobileHideHint {
  display: none;
}
```

- [ ] **Step 6: Lint + build**

```bash
cd vigil-app && npm run lint && npm run build
```
Expected: 0 errors, build succeeds.

- [ ] **Step 7: Commit**

```bash
git add vigil-app/components/VigilDashboard.module.css
git commit -m "feat(mobile): amend 768px breakpoint for tab bar and metric strip"
```

---

## Task 3: Add `mobileTab` state and auto-switch logic

**Files:**
- Modify: `components/VigilDashboard.tsx`

- [ ] **Step 1: Add `mobileTab` state**

After the existing `const [showDrop, setShowDrop]` line (~line 98), add:

```tsx
const [mobileTab, setMobileTab] = useState<"feed" | "detail" | "intel">("feed");
```

- [ ] **Step 2: Update `handleThreatClick` to handle both select and deselect**

Replace the existing `handleThreatClick` (~line 383):

```tsx
const handleThreatClick = useCallback((t: Threat) => {
  setSelected((prev) => {
    const next = prev?.id === t.id ? null : t;
    // auto-switch tab: Detail when selecting, Feed when deselecting (toggle)
    setMobileTab(next ? "detail" : "feed");
    return next;
  });
}, []);
```

`setMobileTab` inside the functional updater is safe — React batches these state updates. On desktop the tab bar is hidden via CSS so the `mobileTab` state change has no visible effect.

- [ ] **Step 3: Update `onClose` in the DetailPanel JSX to auto-switch back to feed**

The `onClose` prop is at line ~747. Replace:
```tsx
onClose={() => setSelected(null)}
```
With:
```tsx
onClose={() => { setSelected(null); setMobileTab("feed"); }}
```

- [ ] **Step 4: Add a `useEffect` to handle poll-driven deselection**

After the existing `useEffect` that syncs `notificationsEnabledRef` (~line 104), add:

```tsx
// On mobile: if a 15s poll clears `selected` while on the Detail tab, return to Feed.
useEffect(() => {
  if (!selected && mobileTab === "detail") setMobileTab("feed");
}, [selected, mobileTab]);
```

- [ ] **Step 5: Lint check**

```bash
cd vigil-app && npm run lint
```
Expected: 0 errors.

- [ ] **Step 6: Commit**

```bash
git add vigil-app/components/VigilDashboard.tsx
git commit -m "feat(mobile): add mobileTab state and auto-switch logic"
```

---

## Task 4: Restructure columns JSX — extract `DetailPanel`, add conditional classes

**Files:**
- Modify: `components/VigilDashboard.tsx` (the `data ? (...)` branch, lines ~661–758)

**Current structure** (simplified):
```
<div className={styles.columns}>
  <ErrorBoundary label="Threat feed">
    <div className={styles.colLeft}>...</div>
  </ErrorBoundary>
  <ErrorBoundary label="Threat detail">
    <div className={styles.colCenter}>
      {heatmap/portfolio}
      <DetailPanel/>       ← nested inside colCenter
    </div>
  </ErrorBoundary>        ← closes here currently
  <ErrorBoundary label="Right panel">
    <RightPanel/>
  </ErrorBoundary>
```

**Target structure:**
```
<div className={styles.columns}>
  <ErrorBoundary label="Threat feed">
    <div className={styles.colLeft + mobileHidden if not "feed"}>...</div>
  </ErrorBoundary>
  <ErrorBoundary label="Threat detail">
    <div className={styles.colCenter + mobileHidden if not "intel"}>
      {heatmap/portfolio only — no DetailPanel}
    </div>
    <div className={mobileHidden if not "detail"}>
      <DetailPanel/>       ← extracted, plain wrapper div
    </div>
  </ErrorBoundary>        ← closes AFTER the DetailPanel wrapper, not before it
  <ErrorBoundary label="Right panel">
    <div className={mobileHidden if not "intel"}>   ← plain wrapper, no colRight class
      <RightPanel/>
    </div>
  </ErrorBoundary>
```

- [ ] **Step 1: Add conditional class to `colLeft`**

Find (line ~665):
```tsx
<div className={styles.colLeft}>
```
Replace with:
```tsx
<div className={`${styles.colLeft} ${mobileTab !== "feed" ? styles.mobileHidden : ""}`}>
```

- [ ] **Step 2: Restructure `colCenter` + extract `DetailPanel`**

Find the entire colCenter div including DetailPanel (lines ~709–751). The current text to find is:

```tsx
            <div className={styles.colCenter}>
            {view === "portfolio" ? (
              /* ── Portfolio Panel ── */
              <>
                <PortfolioView
```

...through to the closing `</div>` of colCenter and the `</ErrorBoundary>` that follows it.

Replace the entire block with:

```tsx
            <div className={`${styles.colCenter} ${mobileTab !== "intel" ? styles.mobileHidden : ""}`}>
            {view === "portfolio" ? (
              /* ── Portfolio Panel ── */
              <>
                <PortfolioView
                  portfolio={portfolio}
                  portfolioSearch={portfolioSearch}
                  setPortfolioSearch={setPortfolioSearch}
                  showDrop={showDrop}
                  setShowDrop={setShowDrop}
                  dropRef={dropRef}
                  searchSuggestions={searchSuggestions}
                  assetMetaBySym={assetMetaBySym}
                  getRiskForSym={(sym) => {
                    const meta = assetMetaBySym[sym];
                    const sectorsForAsset =
                      meta?.sectors?.length
                        ? meta.sectors
                        : STATIC_ASSET_SECTORS[sym] ?? ["Technology"];
                    return getAssetRisk(sym, data.threats, threatsByAsset, sectorsForAsset);
                  }}
                  addToPortfolio={addToPortfolio}
                  removeFromPortfolio={removeFromPortfolio}
                  reorderPortfolio={reorderPortfolio}
                />
              </>
            ) : (
              <SectorHeatmap
                sectors={data.sectors}
                sectorFilter={sectorFilter}
                onSelectSector={handleSectorClick}
              />
            )}
            </div>
            <div className={mobileTab !== "detail" ? styles.mobileHidden : ""}>
              <DetailPanel
                view={view}
                selected={selected}
                portfolio={portfolio}
                onClose={() => { setSelected(null); setMobileTab("feed"); }}
                addToPortfolio={addToPortfolio}
              />
            </div>
```

**Critical:** The `</ErrorBoundary>` for `label="Threat detail"` must close AFTER this new `DetailPanel` wrapper div — not before it. The `</ErrorBoundary>` tag moves from its current position (after the old `colCenter` closing `</div>`) to after the new `DetailPanel` wrapper `</div>`.

- [ ] **Step 3: Wrap `RightPanel` in a plain visibility div**

Find (lines ~753–756):
```tsx
          {/* ── RIGHT: Probabilities + Forces + Sources ── */}
          <ErrorBoundary label="Right panel">
            <RightPanel data={data} />
          </ErrorBoundary>
```

Replace with:
```tsx
          {/* ── RIGHT: Probabilities + Forces + Sources ── */}
          <ErrorBoundary label="Right panel">
            <div className={mobileTab !== "intel" ? styles.mobileHidden : ""}>
              <RightPanel data={data} />
            </div>
          </ErrorBoundary>
```

Do NOT add `className={styles.colRight}` — `RightPanel` renders its own `<div className={styles.colRight}>` internally. A second `colRight` wrapper would break the desktop grid.

- [ ] **Step 4: Lint + build**

```bash
cd vigil-app && npm run lint && npm run build
```
Expected: 0 errors, build succeeds. Desktop layout unchanged.

- [ ] **Step 5: Commit**

```bash
git add vigil-app/components/VigilDashboard.tsx
git commit -m "feat(mobile): restructure columns JSX for tab visibility"
```

---

## Task 5: Add tab bar JSX

**Files:**
- Modify: `components/VigilDashboard.tsx`

- [ ] **Step 1: Add the tab bar `<nav>` after the columns ternary**

The columns ternary ends with `)}` (~line 759). Add the following after that `)}` and before the closing `</div>` of the shell:

```tsx
      {/* ── MOBILE TAB BAR ── */}
      <nav className={styles.mobileTabBar}>
        {(["feed", "detail", "intel"] as const).map((tab) => (
          <button
            key={tab}
            type="button"
            className={`${styles.mobileTabBtn} ${mobileTab === tab ? styles.mobileTabBtnActive : ""}`}
            onClick={() => setMobileTab(tab)}
          >
            <span className={styles.mobileTabIcon}>
              {tab === "feed" ? "⚡" : tab === "detail" ? "◎" : "▦"}
            </span>
            <span className={styles.mobileTabLabel}>
              {tab === "feed" ? "Feed" : tab === "detail" ? "Detail" : "Intel"}
            </span>
            {tab === "detail" && selected && mobileTab !== "detail" && (
              <span className={styles.mobileTabDot} />
            )}
          </button>
        ))}
      </nav>
```

- [ ] **Step 2: Lint + test + build**

```bash
cd vigil-app && npm run lint && npm run test:run && npm run build
```
Expected: 0 errors, 19 tests pass, build succeeds.

- [ ] **Step 3: Commit**

```bash
git add vigil-app/components/VigilDashboard.tsx
git commit -m "feat(mobile): add bottom tab bar nav"
```

---

## Task 6: Hide keyboard shortcut hint in FilterBar on mobile

**Files:**
- Modify: `components/dashboard/FilterBar.tsx`

Note: `FilterBar.tsx` imports `styles` from `../VigilDashboard.module.css` (not its own CSS module), so `styles.mobileHideHint` resolves correctly — it was added to `VigilDashboard.module.css` in Task 2.

- [ ] **Step 1: Add `mobileHideHint` class to the shortcut hint span**

Find the keyboard shortcut hint `<span>` (contains `[j/k] [Enter] [Esc] [/] [p] [1-4]`). Add `className={styles.mobileHideHint}`:

```tsx
<span
  className={styles.mobileHideHint}
  style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--text-muted)', letterSpacing: '0.05em' }}
>
  [j/k] [Enter] [Esc] [/] [p] [1-4]
</span>
```

- [ ] **Step 2: Lint + test + build**

```bash
cd vigil-app && npm run lint && npm run test:run && npm run build
```
Expected: 0 errors, 19 tests pass, build succeeds.

- [ ] **Step 3: Commit**

```bash
git add vigil-app/components/dashboard/FilterBar.tsx
git commit -m "feat(mobile): hide keyboard shortcut hint on mobile"
```

---

## Task 7: Final verification and push

- [ ] **Step 1: Full verification**

```bash
cd vigil-app && npm run lint && npm run test:run && npm run build
```
Expected: 0 lint errors, 19/19 tests pass, build succeeds with all routes listed.

- [ ] **Step 2: Manual mobile check**

Open `npm run dev` and resize browser to 375px width. Verify:
- Bottom tab bar appears: ⚡ Feed · ◎ Detail · ▦ Intel
- Metric row scrolls horizontally (swipe, no vertical stacking)
- Feed tab: threat list is visible, filter bar works
- Tapping a threat auto-switches to Detail tab
- Tapping the same threat again returns to Feed tab (toggle deselect)
- Red dot on Detail tab button when threat is selected but not on Detail tab
- Intel tab: sector heatmap + right panel visible
- X/close on detail panel returns to Feed tab
- Desktop (>768px): tab bar invisible, all three columns visible simultaneously

- [ ] **Step 3: Push**

```bash
git push
```
