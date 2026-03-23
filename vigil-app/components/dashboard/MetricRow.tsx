"use client";

import styles from "./VigilDashboard.module.css";
import { scoreHex } from "./shared";
import type { ViewMode } from "./dashboardTypes";

function scoreClass(score: number) {
  if (score > 70) return styles.scoreCritical;
  if (score > 55) return styles.scoreHigh;
  if (score > 35) return styles.scoreMedium;
  return styles.scoreLow;
}

export default function MetricRow({
  view,
  activeThreatsCount,
  categoriesCount,
  globalRisk,
  gprIndex,
  portfolioLength,
  portfolioThreatsCount,
  allAssetsLength,
  topAssets,
}: {
  view: ViewMode;
  activeThreatsCount: number | null;
  categoriesCount: number;
  globalRisk: number;
  gprIndex: number;
  portfolioLength: number;
  portfolioThreatsCount: number;
  allAssetsLength: number;
  topAssets: string;
}) {
  const gprSubtitle = gprIndex >= 180 ? "(elevated)" : "(normal)";
  const assetsLabel = view === "portfolio" ? "Portfolio Positions" : "Assets at Risk";

  return (
    <div className={styles.metricRow}>
      <div className={styles.metricCard}>
        <div className={styles.metricLabel}>Active Threats</div>
        <div className={styles.metricValue}>{activeThreatsCount ?? "—"}</div>
        <div className={styles.metricSub}>across {categoriesCount} categories</div>
      </div>

      <div className={styles.metricCard}>
        <div className={styles.metricLabel}>Global Risk Index</div>
        <div className={`${styles.metricValue} ${scoreClass(globalRisk)}`}>
          {globalRisk.toFixed(0)}
          <span className={styles.metricValueUnit}>/100</span>
        </div>
        <div className={styles.riskBar}>
          <div
            className={styles.riskBarFill}
            style={{ width: `${globalRisk}%`, background: scoreHex(globalRisk) }}
          />
        </div>
      </div>

      <div className={styles.metricCard}>
        <div className={styles.metricLabel}>GPR Index</div>
        <div className={styles.metricValue}>{gprIndex}</div>
        <div className={styles.metricSub}>{gprSubtitle}</div>
      </div>

      <div className={styles.metricCard}>
        <div className={styles.metricLabel}>{assetsLabel}</div>
        <div className={styles.metricValue}>
          {view === "portfolio" ? portfolioLength || "—" : allAssetsLength || "—"}
        </div>
        <div className={styles.metricSub}>
          {view === "portfolio"
            ? portfolioLength
              ? `${portfolioThreatsCount} active threat${portfolioThreatsCount !== 1 ? "s" : ""}`
              : "no positions tracked"
            : topAssets || "loading…"}
        </div>
      </div>
    </div>
  );
}

