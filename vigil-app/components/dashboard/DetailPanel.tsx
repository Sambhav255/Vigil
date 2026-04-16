"use client";

import { useCallback, useMemo, useRef, useState } from "react";
import styles from "../VigilDashboard.module.css";
import type { Threat, ViewMode } from "./dashboardTypes";
import { SEVERITY_COLOR, scoreHex } from "./shared";
import type { CSSProperties } from "react";

function getThreatContext(threat: Threat): { headline: string; mechanism: string; watch: string } {
  const contexts: Record<string, { headline: string; mechanism: string; watch: string }> = {
    Geopolitical: {
      headline: "Geopolitical risk events create rapid repricing across correlated assets",
      mechanism:
        "Military or diplomatic escalation → supply chain uncertainty → risk-off positioning → sector rotation to safe havens (GLD, TLT, DXY)",
      watch: "Watch for: VIX spike >25, volume surge in put options on affected tickers, sudden USD strength",
    },
    Macroeconomic: {
      headline: "Macro surprises force rapid repricing of rate expectations and growth outlook",
      mechanism:
        "Economic data / Fed signal → bond market reprices → USD moves → equity multiples compress or expand → sector rotation",
      watch: "Watch for: TLT/IEF moves, DXY breakout, SPY/QQQ gap opens, yield curve shift",
    },
    Regulatory: {
      headline: "Regulatory actions create legal uncertainty premium that compresses valuations",
      mechanism:
        "Enforcement action → legal cost uncertainty → institutional reduced exposure → peer sector trades down → earnings estimate revisions",
      watch: "Watch for: unusual put volume, analyst price target cuts, sector ETF outflows",
    },
    "Supply Chain": {
      headline: "Supply disruptions cascade from physical chokepoints to financial markets with a lag",
      mechanism:
        "Route/facility disruption → shipping rate spike → inventory cost increase → margin compression → revenue miss → stock repricing",
      watch: "Watch for: Baltic Dry Index moves, container shipping ETFs (BOAT), energy commodity spikes",
    },
    Climate: {
      headline: "Natural events create immediate commodity price dislocations and infrastructure risk",
      mechanism:
        "Event intensification → facility evacuation/shutdown → supply reduction → commodity spike (CL, NG, CORN) → energy sector volatility",
      watch: "Watch for: CL futures gap, XLE/XOP moves, insurance sector repricing, regional utility stocks",
    },
    Sentiment: {
      headline: "Sentiment shifts can override fundamentals short-term but historically mean-revert",
      mechanism:
        "Narrative change → positioning shift → options market repricing → price momentum → either trend continuation or sharp reversal",
      watch: "Watch for: put/call ratio extremes, AAII sentiment survey, short interest changes, options skew",
    },
  };

  return contexts[threat.category] ?? contexts.Geopolitical;
}

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

  const [analyzePhase, setAnalyzePhase] = useState<"idle" | "loading" | "error" | "done">("idle");
  const [analyzeError, setAnalyzeError] = useState<string | null>(null);
  const [analyzeText, setAnalyzeText] = useState<string | null>(null);
  const [watchAdded, setWatchAdded] = useState(false);
  const watchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const runAnalyze = useCallback(async () => {
    if (!selected) return;
    setAnalyzePhase("loading");
    setAnalyzeError(null);
    try {
      const res = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          threatTitle: selected.title,
          category: selected.category,
          severity: selected.severity,
          assets: selected.assets,
          probability: selected.probability,
        }),
      });
      if (res.status === 503) {
        setAnalyzePhase("error");
        setAnalyzeError("AI unavailable — add GROQ_API_KEY to your environment.");
        return;
      }
      const json = (await res.json()) as { ok?: boolean; message?: string; analysis?: string };
      if (!res.ok || !json.ok) {
        setAnalyzePhase("error");
        setAnalyzeError(json.message ?? "Analysis failed.");
        return;
      }
      setAnalyzeText(json.analysis ?? "");
      setAnalyzePhase("done");
    } catch {
      setAnalyzePhase("error");
      setAnalyzeError("Network error.");
    }
  }, [selected]);

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
          <div className={styles.detailEmpty}>
            <div style={{ marginBottom: 8, fontSize: 20, opacity: 0.2 }}>◎</div>
            <div>Select a threat to view intelligence brief</div>
            <div style={{ fontSize: 10, marginTop: 4, opacity: 0.6 }}>j/k to navigate · Enter to select</div>
          </div>
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

            {(() => {
              const ctx = getThreatContext(selected);
              return (
                <div
                  style={{
                    margin: "8px 0 10px",
                    padding: "10px 12px",
                    background: "rgba(24,24,27,0.5)",
                    border: "1px solid rgba(39,39,42,0.4)",
                    borderRadius: 5,
                  }}
                >
                  <div
                    style={{
                      fontSize: 10,
                      textTransform: "uppercase",
                      letterSpacing: "0.12em",
                      color: "var(--text-muted)",
                      marginBottom: 6,
                      fontWeight: 500,
                    }}
                  >
                    Mechanism
                  </div>
                  <div
                    style={{
                      fontSize: 11,
                      color: "var(--text-secondary)",
                      lineHeight: 1.6,
                      marginBottom: 8,
                    }}
                  >
                    {ctx.mechanism}
                  </div>
                  <div
                    style={{
                      fontSize: 10,
                      textTransform: "uppercase",
                      letterSpacing: "0.12em",
                      color: "var(--text-muted)",
                      marginBottom: 4,
                      fontWeight: 500,
                    }}
                  >
                    What to Watch
                  </div>
                  <div style={{ fontSize: 11, color: "var(--sev-medium)", lineHeight: 1.5 }}>{ctx.watch}</div>
                </div>
              );
            })()}

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
                  onClick={() => {
                    selected.assets.forEach(addToPortfolio);
                    setWatchAdded(true);
                    if (watchTimerRef.current) clearTimeout(watchTimerRef.current);
                    watchTimerRef.current = setTimeout(() => setWatchAdded(false), 1500);
                  }}
                  title="Add all affected assets to portfolio"
                >
                  {watchAdded ? 'Added ✓' : '+ Watch Assets'}
                </button>
                <button
                  type="button"
                  className={styles.analyzeBtn}
                  disabled={analyzePhase === "loading"}
                  onClick={() => void runAnalyze()}
                >
                  {analyzePhase === "loading" ? "… Analyzing" : "⚡ Analyze"}
                </button>
              </div>
            </div>

            {(analyzePhase === "error" || analyzePhase === "done") && (
              <div
                style={{
                  marginTop: 10,
                  padding: "10px 12px",
                  borderRadius: 6,
                  border: "1px solid rgba(39,39,42,0.5)",
                  background: "rgba(24,24,27,0.45)",
                  maxHeight: 220,
                  overflow: "auto",
                }}
              >
                {analyzePhase === "error" && (
                  <div style={{ fontSize: 11, color: "var(--sev-high)" }}>{analyzeError}</div>
                )}
                {analyzePhase === "done" && analyzeText && (
                  <div
                    style={{
                      fontSize: 11,
                      color: "var(--text-secondary)",
                      lineHeight: 1.55,
                      whiteSpace: "pre-wrap",
                    }}
                  >
                    {analyzeText}
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </>
  );
}

