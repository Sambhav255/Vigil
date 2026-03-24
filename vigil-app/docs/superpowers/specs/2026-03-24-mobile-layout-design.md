# Mobile Layout — Design Spec

**Date:** 2026-03-24
**Status:** Approved
**Scope:** Add a bottom tab navigation pattern for mobile (`≤768px`). No functionality changes. Desktop layout unchanged.

---

## Goal

Make the Vigil dashboard fully usable on a mobile browser. The current 768px breakpoint stacks all three columns vertically — unusable because of excessive scrolling with no way to jump between sections. The fix is a bottom tab bar that shows one section at a time, matching the native app pattern used by Bloomberg/Reuters mobile.

---

## Layout Structure

```
┌─────────────────────────┐
│  Ticker bar (34px)      │  fixed top
│  Metric strip (scroll→) │  horizontal scroll, no stacking
├─────────────────────────┤
│                         │
│   Active tab content    │  fills remaining height, scrollable
│                         │
├─────────────────────────┤
│  [⚡ Feed] [◎ Detail] [▦ Intel] │  fixed bottom, 56px
└─────────────────────────┘
```

**Tabs:**
| Tab | Icon | Content | Maps to |
|---|---|---|---|
| `feed` | ⚡ | FilterBar + threat list | colLeft |
| `detail` | ◎ | DetailPanel | wrapper div (no colRight class) |
| `intel` | ▦ | SectorHeatmap + RightPanel | colCenter + colRight (inside RightPanel) |

Desktop (>768px): tab bar hidden, all columns visible simultaneously as before.

---

## State

One new state variable in `VigilDashboard.tsx`:
```typescript
const [mobileTab, setMobileTab] = useState<"feed" | "detail" | "intel">("feed")
```

**Auto-switch to Detail on threat select** — update the threat selection handler:
```typescript
setSelected(threat);
setMobileTab("detail"); // no SSR guard needed — this is a user event callback in a "use client" component
```

**Auto-switch to Feed on detail close** — update the `onClose` handler:
```typescript
setSelected(null);
setMobileTab("feed");
```

**Auto-switch to Feed when poll clears selected threat** — add a new `useEffect`:
```typescript
useEffect(() => {
  if (!selected && mobileTab === "detail") setMobileTab("feed");
}, [selected, mobileTab]);
```
This handles the edge case where the 15-second data poll causes `selected` to become null while the user is on the Detail tab.

---

## Column Visibility

Each section gets `.mobileHidden` applied when it's not the active tab. `.mobileHidden` is a no-op on desktop (not defined outside the media query).

```tsx
// Left column (feed)
<div className={`${styles.colLeft} ${mobileTab !== "feed" ? styles.mobileHidden : ""}`}>

// Center column (intel — heatmap only)
<div className={`${styles.colCenter} ${mobileTab !== "intel" ? styles.mobileHidden : ""}`}>

// DetailPanel: wrap in a plain unstyled div (NOT a colRight div — RightPanel owns its own colRight internally)
<div className={mobileTab !== "detail" ? styles.mobileHidden : ""}>
  <DetailPanel ... />
</div>

// RightPanel: wrap in a plain unstyled div
<div className={mobileTab !== "intel" ? styles.mobileHidden : ""}>
  <RightPanel ... />
</div>
```

**Important:** Do NOT add `colRight` or any grid class to the wrapper divs around `DetailPanel` or `RightPanel`. `RightPanel` renders its own `<div className={styles.colRight}>` internally — adding another `colRight` div outside would double-nest the class and break the desktop grid.

---

## Tab Bar JSX

Added as a `<nav className={styles.mobileTabBar}>` directly after the `.columns` div, inside the `ErrorBoundary`:

```tsx
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

---

## CSS Changes (`VigilDashboard.module.css`)

### New classes — append at end of file

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
  /* defined here as a no-op; overridden to display:none in 768px block */
}
```

### Updates to existing `@media (max-width: 768px)` block

**Amend** the existing rules in place — do not add a second `@media (max-width: 768px)` block. Existing rules for `.shell`, `.tickerBar`, `.filterBar`, `.filterSpacer`, `.filterSearch`, `.filterSearchInput`, `.filterRight`, `.columns`, `.colLeft/.colCenter/.colRight`, `.heatmapGrid`, `.detailPanel`, `.portfolioSummaryRow` are already present and should be kept.

Add or update the following within the existing block:

```css
/* Replace existing .metricRow rule with: */
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

/* Add new .metricCard rule */
.metricCard {
  min-width: 130px;
  flex-shrink: 0;
}

/* Add to existing .shell rule (already has height:auto, overflow:auto) */
/* append: */
.shell {
  padding-bottom: 56px; /* prevent content hiding behind fixed tab bar */
}

/* Add: tab bar visible on mobile */
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

/* Add: hidden utility */
.mobileHidden {
  display: none !important;
}

/* Add to existing .colLeft, .colCenter, .colRight rule: */
/* height: auto; min-height: unset; */

/* Add: hide keyboard shortcut hint */
.mobileHideHint {
  display: none;
}
```

### Keyboard shortcut hint in FilterBar.tsx

`FilterBar.tsx` imports `styles` from `../VigilDashboard.module.css` (not its own CSS module). Add `className={styles.mobileHideHint}` to the keyboard shortcut hint `<span>`:

```tsx
<span
  className={styles.mobileHideHint}
  style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--text-muted)', letterSpacing: '0.05em' }}
>
  [j/k] [Enter] [Esc] [/] [p] [1-4]
</span>
```

---

## Files Changed

| File | Change |
|---|---|
| `components/VigilDashboard.tsx` | `mobileTab` state, auto-switch logic (select/close/poll effect), conditional classes, tab bar JSX, plain wrapper divs around DetailPanel and RightPanel |
| `components/VigilDashboard.module.css` | New tab bar classes appended; existing 768px block amended (not duplicated) |
| `components/dashboard/FilterBar.tsx` | Add `className={styles.mobileHideHint}` to shortcut hint span |

No new files. No API or data changes.

---

## Verification Gates

```bash
npm run lint && npm run test:run && npm run build
```

Expected: 0 lint errors, 19 tests pass, build succeeds.

Manual check: resize browser to 375px — tab bar appears, metric row scrolls horizontally, each tab shows its content exclusively, selecting a threat auto-switches to Detail tab.
