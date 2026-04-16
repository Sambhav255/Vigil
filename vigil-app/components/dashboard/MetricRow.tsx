"use client";

import styles from "../VigilDashboard.module.css";
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
  criticalThreatCount,
  highThreatCount,
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
  criticalThreatCount: number;
  highThreatCount: number;
}) {
  const gprSubtitle = gprIndex >= 180 ? "(elevated)" : "(normal)";
  const assetsLabel = view === "portfolio" ? "Portfolio Positions" : "Assets at Risk";

  return (
    <div className={styles.metricRow}>
      <div className={styles.metricCard}>
        <div className={styles.metricLabel}>Active Threats</div>
        <div className={styles.metricValue}>{activeThreatsCount ?? "—"}</div>
        <div className={styles.metricSub}>across {categoriesCount} categories</div>
        {activeThreatsCount !== null && (criticalThreatCount > 0 || highThreatCount > 0) && (
          <div style={{ display: "flex", gap: 6, marginTop: 4, flexWrap: "wrap" }}>
            {criticalThreatCount > 0 && (
              <span
                style={{
                  fontSize: 9,
                  color: "var(--sev-critical)",
                  fontFamily: "var(--font-mono)",
                  fontWeight: 600,
                }}
              >
                {criticalThreatCount} CRIT
              </span>
            )}
            {highThreatCount > 0 && (
              <span
                style={{
                  fontSize: 9,
                  color: "var(--sev-high)",
                  fontFamily: "var(--font-mono)",
                  fontWeight: 600,
                }}
              >
                {highThreatCount} HIGH
              </span>
            )}
          </div>
        )}
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

