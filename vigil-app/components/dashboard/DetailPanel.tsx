"use client";

import { useMemo } from "react";
import styles from "./VigilDashboard.module.css";
import type { Threat, ViewMode } from "./dashboardTypes";
import { SEVERITY_COLOR, scoreHex } from "./shared";
import type { CSSProperties } from "react";

function Sparkline({ data, color }: { data: number[]; color: string }) {
  const W = 140;
  const H = 28;
  if (!data.length) return null;
  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 0.01;
  const pts = data
    .map((v, i) => {
      const x = ((i / (data.length - 1)) * (W - 4) + 2).toFixed(1);
      const y = (H - 2 - ((v - min) / range) * (H - 8)).toFixed(1);
      return `${x},${y}`;
    })
    .join(" ");
  return (
    <svg
      width={W}
      height={H}
      style={{ display: "block", overflow: "visible", filter: `drop-shadow(0 0 6px ${color}55)` }}
    >
      <polyline points={pts} fill="none" stroke={color} strokeWidth="1.5" strokeLinejoin="round" />
    </svg>
  );
}

export default function DetailPanel({
  view,
  selected,
  portfolio,
  onClose,
  addToPortfolio,
}: {
  view: ViewMode;
  selected: Threat | null;
  portfolio: string[];
  onClose: () => void;
  addToPortfolio: (sym: string) => void;
}) {
  const marginTopStyle = useMemo(() => ({ marginTop: view === "portfolio" ? 14 : 0 } as CSSProperties), [view]);

  const SEV_BADGE: Record<Threat["severity"], string> = {
    critical: styles.badgeCritical,
    high: styles.badgeHigh,
    medium: styles.badgeMedium,
    low: styles.badgeLow,
  };

  return (
    <>
      <div className={styles.sectionHeader} style={marginTopStyle}>
        Threat Detail
      </div>

      <div className={styles.detailPanel}>
        {!selected ? (
          <div className={styles.detailEmpty}>Select a threat card to view details</div>
        ) : (
          <div className={styles.detailContent}>
            <div className={styles.detailHeader}>
              <div>
                <div className={styles.badgeRow}>
                  <span className={`${styles.badge} ${SEV_BADGE[selected.severity] ?? ""}`}>
                    {selected.severity}
                  </span>
                  <span className={styles.badge}>{selected.category}</span>
                </div>
                <div className={styles.detailTitle}>{selected.title}</div>
              </div>
              <button type="button" className={styles.closeBtn} onClick={onClose}>
                ×
              </button>
            </div>

            <div
              className={styles.detailSummary}
              style={{
                borderLeftColor: `${SEVERITY_COLOR[selected.severity] ?? "#2d6eb0"}4d`,
              }}
            >
              {selected.summary}
            </div>

            <div className={styles.detailGrid}>
              <div className={styles.detailBox}>
                <div className={styles.detailBoxLabel}>Probability</div>
                <div className={styles.detailProbNum}>
                  {(selected.probability * 100).toFixed(0)}%
                  <span
                    style={{
                      fontSize: 12,
                      marginLeft: 6,
                      color:
                        selected.probDelta > 0
                          ? "#c42626"
                          : selected.probDelta < 0
                            ? "#25784a"
                            : "#4a4845",
                    }}
                  >
                    {selected.probDelta > 0 ? "▲" : selected.probDelta < 0 ? "▼" : "—"}{" "}
                    {Math.abs(selected.probDelta * 100).toFixed(0)}%
                  </span>
                </div>
                <Sparkline
                  data={selected.probHistory}
                  color={selected.probSource === "Polymarket" ? "#5b5fef" : "#2a8a5e"}
                />
                <div className={styles.detailBoxSub}>
                  <span
                    className={
                      selected.probSource === "Polymarket" ? styles.srcPolymarket : styles.srcKalshi
                    }
                  >
                    {selected.probSource}
                  </span>
                  {" · "}
                  <span
                    className={`${styles.confBadge} ${
                      selected.confidence === "high"
                        ? styles.confHigh
                        : selected.confidence === "medium"
                          ? styles.confMed
                          : styles.confLow
                    }`}
                  >
                    {selected.confidence.toUpperCase()} CONF
                  </span>
                </div>
              </div>

              <div className={styles.detailBox}>
                <div className={styles.detailBoxLabel}>Cascade Timeline</div>
                <div className={styles.detailCascadeEta}>{selected.cascadeEta}</div>
                <div className={styles.detailBoxSub}>estimated market repricing window</div>
                <div className={styles.riskBar} style={{ marginTop: 8 }}>
                  <div
                    className={styles.riskBarFill}
                    style={{ width: "35%", background: scoreHex(40) }}
                  />
                </div>
                <div className={styles.pricedInLabel}>~35% priced in</div>
              </div>
            </div>

            {selected.probHistory.length > 0 && (
              <div className={styles.detailTimeline}>
                <div className={styles.detailBoxLabel}>Threat Timeline</div>
                <div className={styles.detailTimelineList}>
                  {[...selected.probHistory].slice(-7).reverse().map((point, idx) => {
                    const minutesAgo = idx * 30;
                    const label = minutesAgo === 0 ? "now" : `${minutesAgo}m ago`;
                    return (
                      <div key={`${selected.id}-${idx}-${point}`} className={styles.detailTimelineItem}>
                        <span className={styles.detailTimelineDot} />
                        <span className={styles.detailTimelineLabel}>{label}</span>
                        <span className={styles.detailTimelineValue}>{(point * 100).toFixed(0)}%</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            <div className={styles.assetChips} style={{ marginBottom: 10 }}>
              {selected.assets.map((a) => (
                <span
                  key={a}
                  className={`${styles.assetChip} ${
                    selected.direction === "bearish"
                      ? styles.assetChipBearish
                      : selected.direction === "bullish"
                        ? styles.assetChipBullish
                        : ""
                  } ${portfolio.includes(a) ? styles.assetChipInPortfolio : ""}`}
                  style={{ fontSize: 11, padding: "3px 8px" }}
                >
                  <span
                    className={
                      selected.direction === "bearish"
                        ? styles.dirBearish
                        : selected.direction === "bullish"
                          ? styles.dirBullish
                          : styles.dirNeutral
                    }
                  >
                    {selected.direction === "bearish" ? "↓" : selected.direction === "bullish" ? "↑" : "→"}
                  </span>
                  {a}
                  {portfolio.includes(a) && <span className={styles.assetChipPortfolioMark}>●</span>}
                </span>
              ))}
            </div>

            <div className={styles.detailFooter}>
              <div style={{ fontSize: 10, color: "var(--text-muted)" }}>
                <span>{selected.sourceCount} sources</span> {" · "}
                <span
                  className={
                    selected.momentum === "escalating"
                      ? styles.momentumEsc
                      : selected.momentum === "peaking"
                        ? styles.momentumPeak
                        : styles.momentumFade
                  }
                >
                  {selected.momentum === "escalating"
                    ? "▲ escalating"
                    : selected.momentum === "peaking"
                      ? "● peaking"
                      : "▼ fading"}
                </span>
              </div>
              <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                <button
                  type="button"
                  className={styles.analyzeBtn}
                  onClick={() => selected.assets.forEach(addToPortfolio)}
                  title="Add all affected assets to portfolio"
                >
                  + Watch Assets
                </button>
                <button type="button" className={styles.analyzeBtn}>
                  ⚡ Analyze
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  );
}

