"use client";

import styles from "./VigilDashboard.module.css";
import type { Threat } from "./dashboardTypes";
import { fmtVol } from "./shared";

const SEV_CARD: Record<Threat["severity"], string> = {
  critical: styles.sevCritical,
  high: styles.sevHigh,
  medium: styles.sevMedium,
  low: styles.sevLow,
};

const SEV_SELECTED: Record<Threat["severity"], string> = {
  critical: styles.selectedCritical,
  high: styles.selectedHigh,
  medium: styles.selectedMedium,
  low: styles.selectedLow,
};

const SEV_BADGE: Record<Threat["severity"], string> = {
  critical: styles.badgeCritical,
  high: styles.badgeHigh,
  medium: styles.badgeMedium,
  low: styles.badgeLow,
};

function probDeltaClass(delta: number) {
  if (delta > 0) return styles.probDeltaPos;
  if (delta < 0) return styles.probDeltaNeg;
  return styles.probDeltaNeutral;
}

function formatRelativeTime(createdAt: number, nowMs: number) {
  const deltaMs = Math.max(0, nowMs - createdAt);
  const mins = Math.floor(deltaMs / (60 * 1000));
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

export default function ThreatCard({
  threat,
  isSelected,
  portfolio,
  nowMs,
  changedKind,
  onClick,
}: {
  threat: Threat;
  isSelected: boolean;
  portfolio: string[];
  nowMs: number;
  changedKind?: "new" | "prob" | "sev" | null;
  onClick: () => void;
}) {
  return (
    <article
      className={[
        styles.threatCard,
        SEV_CARD[threat.severity],
        isSelected ? SEV_SELECTED[threat.severity] : "",
        changedKind ? styles.threatChanged : "",
      ].filter(Boolean).join(" ")}
      onClick={onClick}
    >
      <div className={styles.badgeRow}>
        <span className={`${styles.badge} ${SEV_BADGE[threat.severity] ?? ""}`}>{threat.severity}</span>
        <span className={styles.badge}>{threat.category}</span>
        <span
          className={
            threat.momentum === "escalating"
              ? styles.momentumEsc
              : threat.momentum === "peaking"
                ? styles.momentumPeak
                : styles.momentumFade
          }
        >
          {threat.momentum === "escalating"
            ? "▲ escalating"
            : threat.momentum === "peaking"
              ? "● peaking"
              : "▼ fading"}
        </span>
        {!threat.verified && <span className={styles.badgeUnverified}>UNVERIFIED</span>}
      </div>

      <div className={styles.threatTitle}>{threat.title}</div>

      <div className={styles.assetChips}>
        {threat.assets.map((a) => (
          <span
            key={a}
            className={`${styles.assetChip} ${
              threat.direction === "bearish"
                ? styles.assetChipBearish
                : threat.direction === "bullish"
                  ? styles.assetChipBullish
                  : ""
            } ${portfolio.includes(a) ? styles.assetChipInPortfolio : ""}`}
          >
            <span
              className={
                threat.direction === "bearish"
                  ? styles.dirBearish
                  : threat.direction === "bullish"
                    ? styles.dirBullish
                    : styles.dirNeutral
              }
            >
              {threat.direction === "bearish" ? "↓" : threat.direction === "bullish" ? "↑" : "→"}
            </span>
            {a}
            {portfolio.includes(a) && <span className={styles.assetChipPortfolioMark}>●</span>}
          </span>
        ))}
      </div>

      <div className={styles.probRow}>
        <div className={styles.probBarWrap}>
          <div
            className={`${styles.probBarFill} ${
              threat.probSource === "Polymarket" ? styles.probBarPolymarket : styles.probBarKalshi
            }`}
            style={{ width: `${(threat.probability * 100).toFixed(0)}%` }}
          />
        </div>
        <span className={styles.probPct}>{(threat.probability * 100).toFixed(0)}%</span>
        <span
          className={`${styles.confBadge} ${
            threat.confidence === "high"
              ? styles.confHigh
              : threat.confidence === "medium"
                ? styles.confMed
                : styles.confLow
          }`}
        >
          {threat.confidence === "high"
            ? "HIGH CONF"
            : threat.confidence === "medium"
              ? "MED CONF"
              : "LOW CONF"}
        </span>
      </div>

      <div className={styles.cardFooter}>
        <div className={styles.footerLeft}>
          <span
            className={threat.probSource === "Polymarket" ? styles.srcPolymarket : styles.srcKalshi}
          >
            {threat.probSource} · {fmtVol(threat.volume)}
          </span>
          <span className={probDeltaClass(threat.probDelta)}>
            {threat.probDelta > 0 ? "+" : ""}
            {(threat.probDelta * 100).toFixed(0)}% 24h
          </span>
          <span className={styles.threatRelativeTime}>{formatRelativeTime(threat.createdAt, nowMs)}</span>
          {changedKind && <span className={styles.threatChangedBadge}>{changedKind === "new" ? "NEW" : changedKind === "sev" ? "SEV↑" : "ΔP"}</span>}
        </div>
        <span className={styles.cascadeEta}>{threat.cascadeEta}</span>
      </div>
    </article>
  );
}

