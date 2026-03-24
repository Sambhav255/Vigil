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
│  [⚡ Feed] [◎ Detail] [▦ Intel] │  fixed bottom, 44px
└─────────────────────────┘
```

**Tabs:**
| Tab | Icon | Content | Maps to |
|---|---|---|---|
| `feed` | ⚡ | FilterBar + threat list | colLeft |
| `detail` | ◎ | DetailPanel | inline below colCenter |
| `intel` | ▦ | SectorHeatmap + RightPanel | colCenter + colRight |

Desktop (>768px): tab bar hidden, all columns visible simultaneously as before.

---

## State

One new state variable in `VigilDashboard.tsx`:
```typescript
const [mobileTab, setMobileTab] = useState<"feed" | "detail" | "intel">("feed")
```

**Auto-switch to Detail on threat select:**
Update the threat selection handler to add:
```typescript
if (typeof window !== "undefined" && window.innerWidth <= 768) setMobileTab("detail");
```

**Auto-switch to Feed on detail close:**
Update `onClose` (the `() => setSelected(null)` handler) to add:
```typescript
if (typeof window !== "undefined" && window.innerWidth <= 768) setMobileTab("feed");
```

`typeof window !== "undefined"` guard required for SSR safety.

---

## Column Visibility

Each section gets a `.mobileHidden` class applied when it's not the active tab. `.mobileHidden` is a no-op on desktop.

```tsx
// Left column (feed)
<div className={`${styles.colLeft} ${mobileTab !== "feed" ? styles.mobileHidden : ""}`}>

// Center column (intel — heatmap only, no detail panel)
<div className={`${styles.colCenter} ${mobileTab !== "intel" ? styles.mobileHidden : ""}`}>

// DetailPanel wrapper div
<div className={mobileTab !== "detail" ? styles.mobileHidden : ""}>
  <DetailPanel ... />
</div>

// Right column (intel)
<div className={`${styles.colRight} ${mobileTab !== "intel" ? styles.mobileHidden : ""}`}>
```

The DetailPanel wrapper is a new `<div>` added around the existing `<DetailPanel>` in the JSX. It does not affect desktop layout.

---

## Tab Bar JSX

Added as a `<nav>` element directly after the `.columns` div, inside the ErrorBoundary:

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

### New classes (added at end of file)

```css
/* ── Mobile tab bar ─────────────────────────────────────────────── */
.mobileTabBar {
  display: none; /* hidden on desktop */
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

/* ── Mobile hidden utility ──────────────────────────────────────── */
.mobileHidden {
  /* no-op on desktop — overridden in 768px media query */
}
```

### Updates to existing `@media (max-width: 768px)` block

Replace the existing `.metricRow` rule and add new rules:

```css
@media (max-width: 768px) {
  /* existing shell/tickerBar/filterBar rules stay as-is */

  /* metric row → horizontal scroll strip */
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

  /* each metric card: fixed width, don't shrink */
  .metricCard {
    min-width: 130px;
    flex-shrink: 0;
  }

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

  /* add bottom padding to shell so content isn't behind tab bar */
  .shell {
    padding-bottom: 56px;
  }

  /* columns: flex column, no fixed heights */
  .columns {
    display: flex;
    flex-direction: column;
    overflow: visible;
    min-height: unset;
  }

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

  /* hide keyboard shortcut hint on mobile */
  .mobileHideHint {
    display: none;
  }
}
```

### Keyboard shortcut hint

Add `.mobileHideHint` class to the hint `<span>` in `FilterBar.tsx`:
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
| `components/VigilDashboard.tsx` | `mobileTab` state, auto-switch logic, conditional classes, tab bar JSX, DetailPanel wrapper div |
| `components/VigilDashboard.module.css` | New tab bar classes, updated 768px block, metric strip, mobileHidden utility |
| `components/dashboard/FilterBar.tsx` | Add `mobileHideHint` class to shortcut hint span |

No new files. No API or data changes.

---

## Verification Gates

```bash
npm run lint && npm run test:run && npm run build
```

Expected: 0 lint errors, 19 tests pass, build succeeds.

Manual check: resize browser to 375px width — tab bar should appear, metric row should scroll horizontally, each tab should show its content exclusively.
