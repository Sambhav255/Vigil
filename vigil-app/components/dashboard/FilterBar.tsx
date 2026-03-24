"use client";

import styles from "../VigilDashboard.module.css";
import type { AssetFilter, ViewMode } from "./dashboardTypes";

const FILTERS: AssetFilter[] = ["all", "stocks", "crypto", "commodities"];

export default function FilterBar({
  view,
  assetFilter,
  setAssetFilter,
  sectorFilter,
  setSectorFilter,
  assetSearch,
  onAssetSearchChange,
  onTogglePortfolioView,
  timeStr,
  viewThreatCount,
  portfolioLength,
  portfolioThreatsCount,
  notificationsEnabled,
  onToggleNotifications,
}: {
  view: ViewMode;
  assetFilter: AssetFilter;
  setAssetFilter: (f: AssetFilter) => void;
  sectorFilter: string | null;
  setSectorFilter: (s: string | null) => void;
  assetSearch: string;
  onAssetSearchChange: (value: string) => void;
  onTogglePortfolioView: () => void;
  timeStr: string;
  viewThreatCount: number;
  portfolioLength: number;
  portfolioThreatsCount: number;
  notificationsEnabled: boolean;
  onToggleNotifications: () => void;
}) {
  return (
    <div className={styles.filterBar}>
      {view === "dashboard" &&
        FILTERS.map((f) => (
          <button
            key={f}
            type="button"
            onClick={() => {
              setAssetFilter(f);
              setSectorFilter(null);
              onAssetSearchChange("");
            }}
            className={`${styles.filterPill} ${assetFilter === f && !assetSearch ? styles.filterPillActive : ""}`}
          >
            {f.charAt(0).toUpperCase() + f.slice(1)}
          </button>
        ))}

      <button
        type="button"
        onClick={onTogglePortfolioView}
        className={`${styles.filterPill} ${view === "portfolio" ? styles.filterPillActive : ""}`}
      >
        Portfolio{portfolioLength > 0 ? ` (${portfolioLength})` : ""}
      </button>

      {sectorFilter && view === "dashboard" && (
        <span className={styles.sectorChip}>
          {sectorFilter}
          <button
            type="button"
            className={styles.sectorChipClose}
            onClick={() => setSectorFilter(null)}
          >
            ×
          </button>
        </span>
      )}

      <span className={styles.filterSpacer} />

      <div className={`${styles.filterSearch} ${assetSearch ? styles.filterSearchActive : ""}`}>
        <span className={styles.filterSearchIcon}>⌕</span>
        <input
          className={styles.filterSearchInput}
          placeholder="Search asset…"
          value={assetSearch}
          onChange={(e) => onAssetSearchChange(e.target.value)}
        />
        {assetSearch && (
          <button type="button" className={styles.filterSearchClear} onClick={() => onAssetSearchChange("")}>
            ×
          </button>
        )}
      </div>

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
        <span
          className={styles.mobileHideHint}
          style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--text-muted)', letterSpacing: '0.05em' }}
        >
          [j/k] [Enter] [Esc] [/] [p] [1-4]
        </span>
      </div>
    </div>
  );
}

