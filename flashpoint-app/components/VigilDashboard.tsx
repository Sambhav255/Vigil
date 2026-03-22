"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import styles from "./VigilDashboard.module.css";

// ── Type inferred from pipeline return ──────────────────────────────────────
type Snapshot = Awaited<ReturnType<typeof import("@/lib/pipeline").buildDashboardSnapshot>>;
type Threat = Snapshot["threats"][0];
type AssetFilter = "all" | "stocks" | "crypto" | "commodities";

// ── Constants ────────────────────────────────────────────────────────────────
const SEVERITY_COLOR: Record<string, string> = {
  critical: "#ef4444",
  high: "#f59e0b",
  medium: "#3b82f6",
  low: "#22c55e",
};

const SEV_CARD: Record<string, string> = {
  critical: styles.sevCritical,
  high: styles.sevHigh,
  medium: styles.sevMedium,
  low: styles.sevLow,
};

const SEV_BADGE: Record<string, string> = {
  critical: styles.badgeCritical,
  high: styles.badgeHigh,
  medium: styles.badgeMedium,
  low: styles.badgeLow,
};

const SEV_SELECTED: Record<string, string> = {
  critical: styles.selectedCritical,
  high: styles.selectedHigh,
  medium: styles.selectedMedium,
  low: styles.selectedLow,
};

const ASSET_SECTORS: Record<AssetFilter, string[]> = {
  all: [],
  stocks: ["Technology", "Finance", "Defense"],
  crypto: ["Crypto"],
  commodities: ["Energy", "Commodities"],
};

const SOURCE_DISPLAY: Record<string, string> = {
  polymarket: "Polymarket",
  kalshi: "Kalshi",
  gdelt: "GDELT",
  alphaVantage: "Alpha Vantage",
  coinGecko: "CoinGecko",
  gprIndex: "GPR Index",
  geminiFlash: "Gemini Flash",
};

// ── Helpers ──────────────────────────────────────────────────────────────────
function fmtPrice(p: number) {
  if (p >= 10_000) return p.toLocaleString("en-US", { maximumFractionDigits: 0 });
  return p.toFixed(2);
}

function fmtVol(v: number) {
  if (v >= 1_000_000) return `$${(v / 1_000_000).toFixed(1)}M`;
  if (v >= 1_000) return `$${Math.round(v / 1000)}k`;
  return `$${v}`;
}

function scoreClass(score: number) {
  if (score > 70) return styles.scoreCritical;
  if (score > 55) return styles.scoreHigh;
  if (score > 35) return styles.scoreMedium;
  return styles.scoreLow;
}

function scoreHex(score: number) {
  if (score > 70) return SEVERITY_COLOR.critical;
  if (score > 55) return SEVERITY_COLOR.high;
  if (score > 35) return SEVERITY_COLOR.medium;
  return SEVERITY_COLOR.low;
}

function probDeltaClass(delta: number) {
  if (delta > 0) return styles.probDeltaPos;
  if (delta < 0) return styles.probDeltaNeg;
  return styles.probDeltaNeutral;
}

function truncateTitle(title: string, max = 32) {
  if (title.length <= max) return title;
  return `${title.slice(0, max)}…`;
}

// ── Sparkline ─────────────────────────────────────────────────────────────────
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
    <svg width={W} height={H} style={{ display: "block", overflow: "visible" }}>
      <polyline points={pts} fill="none" stroke={color} strokeWidth="1.5" strokeLinejoin="round" />
    </svg>
  );
}

// ── Source status helper ──────────────────────────────────────────────────────
function getSourceDisplay(name: string, state: string) {
  if (name === "gprIndex") return { dot: "#f59e0b", label: "daily" };
  if (name === "geminiFlash") return { dot: "#64748b", label: "standby" };
  if (state === "live") return { dot: "#22c55e", label: "live" };
  if (state === "stale") return { dot: "#f59e0b", label: "stale" };
  if (state === "delayed") return { dot: "#eab308", label: "delayed" };
  return { dot: "#ef4444", label: "offline" };
}

// ── Main Component ────────────────────────────────────────────────────────────
export default function VigilDashboard() {
  const [data, setData] = useState<Snapshot | null>(null);
  const [selected, setSelected] = useState<Threat | null>(null);
  const [assetFilter, setAssetFilter] = useState<AssetFilter>("all");
  const [sectorFilter, setSectorFilter] = useState<string | null>(null);
  const [clock, setClock] = useState<Date>(new Date());

  // Fetch data every 15 s
  useEffect(() => {
    let alive = true;
    const load = async () => {
      try {
        const res = await fetch("/api/dashboard", { cache: "no-store" });
        const json = (await res.json()) as Snapshot;
        if (alive) setData(json);
      } catch {
        // fail silently — will retry on next interval
      }
    };
    void load();
    const id = setInterval(load, 15_000);
    return () => {
      alive = false;
      clearInterval(id);
    };
  }, []);

  // Live clock
  useEffect(() => {
    const id = setInterval(() => setClock(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  // Filtered threats
  const visibleThreats = useMemo(() => {
    if (!data) return [];
    let list = data.threats;
    if (assetFilter !== "all") {
      const secs = ASSET_SECTORS[assetFilter];
      list = list.filter((t) => secs.includes(t.sector));
    }
    if (sectorFilter) {
      list = list.filter((t) => t.sector === sectorFilter);
    }
    return list;
  }, [data, assetFilter, sectorFilter]);

  const handleThreatClick = useCallback((t: Threat) => {
    setSelected((prev) => (prev?.id === t.id ? null : t));
  }, []);

  const handleSectorClick = useCallback((sector: string) => {
    setSectorFilter((prev) => (prev === sector ? null : sector));
  }, []);

  useEffect(() => {
    if (sectorFilter) setAssetFilter("all");
  }, [sectorFilter]);

  // Derived metrics
  const allAssets = useMemo(
    () => (data ? [...new Set(data.threats.flatMap((t) => t.assets))] : []),
    [data]
  );
  const categories = useMemo(
    () => (data ? new Set(data.threats.map((t) => t.category)).size : 0),
    [data]
  );

  // Ticker items: 3 copies for seamless loop
  const tickerItems = data?.tickers ?? [];
  const tickerSet = [...tickerItems, ...tickerItems, ...tickerItems];

  const timeStr = clock.toLocaleTimeString("en-US", {
    hour12: false,
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });

  const gpr = data?.gprIndex ?? 0;
  const risk = data?.globalRisk ?? 0;
  const topAssets = allAssets.slice(0, 4).join(" · ");

  // ── Render ──────────────────────────────────────────────────────────────────
  return (
    <div className={styles.shell}>

      {/* ─── TICKER BAR ─── */}
      <div className={styles.tickerBar}>
        <div className={styles.tickerBrand} aria-label="Vigil">
          VIGIL
        </div>
        <div className={styles.tickerScroll}>
          <div className={styles.tickerTrack}>
            {tickerSet.map((t, i) => (
              <span key={i} className={styles.tickerItem}>
                <span className={styles.tickerSym}>{t.sym}</span>
                <span className={styles.tickerPrice}>
                  ${fmtPrice(t.price)}
                </span>
                <span className={t.chg >= 0 ? styles.tickerChgPos : styles.tickerChgNeg}>
                  {t.chg >= 0 ? "+" : ""}
                  {t.chg.toFixed(2)}%
                </span>
              </span>
            ))}
          </div>
        </div>
      </div>

      {/* ─── METRIC ROW ─── */}
      <div className={styles.metricRow}>
        {/* Active Threats */}
        <div className={styles.metricCard}>
          <div className={styles.metricLabel}>Active Threats</div>
          <div className={styles.metricValue}>{data?.threats.length ?? "—"}</div>
          <div className={styles.metricSub}>across {categories} categories</div>
        </div>

        {/* Global Risk Index */}
        <div className={styles.metricCard}>
          <div className={styles.metricLabel}>Global Risk Index</div>
          <div className={`${styles.metricValue} ${scoreClass(risk)}`}>
            {risk.toFixed(0)}
            <span className={styles.metricValueUnit}>/100</span>
          </div>
          <div className={styles.riskBar}>
            <div
              className={styles.riskBarFill}
              style={{ width: `${risk}%`, background: scoreHex(risk) }}
            />
          </div>
        </div>

        {/* GPR Index — raw index; elevated/normal per Caldara-Iacoviello threshold */}
        <div className={styles.metricCard}>
          <div className={styles.metricLabel}>GPR Index</div>
          <div className={styles.metricValue}>{gpr}</div>
          <div className={styles.metricSub}>{gpr >= 180 ? "(elevated)" : "(normal)"}</div>
        </div>

        {/* Assets at Risk */}
        <div className={styles.metricCard}>
          <div className={styles.metricLabel}>Assets at Risk</div>
          <div className={styles.metricValue}>{allAssets.length || "—"}</div>
          <div className={styles.metricSub}>{topAssets || "loading…"}</div>
        </div>
      </div>

      {/* ─── FILTER BAR ─── */}
      <div className={styles.filterBar}>
        {(["all", "stocks", "crypto", "commodities"] as AssetFilter[]).map((f) => (
          <button
            key={f}
            type="button"
            onClick={() => {
              setAssetFilter(f);
              setSectorFilter(null);
            }}
            className={`${styles.filterPill} ${assetFilter === f ? styles.filterPillActive : ""}`}
          >
            {f.charAt(0).toUpperCase() + f.slice(1)}
          </button>
        ))}

        {sectorFilter && (
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

        <div className={styles.filterRight}>
          <span className={styles.liveDot} />
          <span>LIVE</span>
          <span>{timeStr}</span>
          <span>{visibleThreats.length} THREATS</span>
        </div>
      </div>

      {/* ─── COLUMNS ─── */}
      {!data ? (
        <div className={styles.loadingOverlay}>Initializing intelligence feed…</div>
      ) : (
        <div className={styles.columns}>

          {/* ── LEFT: Threat Feed ── */}
          <div className={styles.colLeft}>
            <div className={styles.sectionHeader}>Live Threat Feed</div>

            {visibleThreats.length === 0 && (
              <div
                style={{ color: "var(--text-muted)", fontSize: 12, textAlign: "center", padding: "24px 0" }}
              >
                No threats match current filters
              </div>
            )}

            {visibleThreats.map((t) => {
              const isSelected = selected?.id === t.id;
              return (
                <article
                  key={t.id}
                  className={[
                    styles.threatCard,
                    SEV_CARD[t.severity],
                    isSelected ? SEV_SELECTED[t.severity] : "",
                  ]
                    .filter(Boolean)
                    .join(" ")}
                  onClick={() => handleThreatClick(t)}
                >
                  {/* Badge row */}
                  <div className={styles.badgeRow}>
                    <span className={`${styles.badge} ${SEV_BADGE[t.severity] ?? ""}`}>
                      {t.severity}
                    </span>
                    <span className={styles.badge}>{t.category}</span>
                    <span
                      className={
                        t.momentum === "escalating"
                          ? styles.momentumEsc
                          : t.momentum === "peaking"
                            ? styles.momentumPeak
                            : styles.momentumFade
                      }
                    >
                      {t.momentum === "escalating"
                        ? "▲ escalating"
                        : t.momentum === "peaking"
                          ? "● peaking"
                          : "▼ fading"}
                    </span>
                    {!t.verified && (
                      <span className={styles.badgeUnverified}>UNVERIFIED</span>
                    )}
                  </div>

                  {/* Title */}
                  <div className={styles.threatTitle}>{t.title}</div>

                  {/* Asset chips */}
                  <div className={styles.assetChips}>
                    {t.assets.map((a) => (
                      <span
                        key={a}
                        className={`${styles.assetChip} ${
                          t.direction === "bearish"
                            ? styles.assetChipBearish
                            : t.direction === "bullish"
                              ? styles.assetChipBullish
                              : ""
                        }`}
                      >
                        <span
                          className={
                            t.direction === "bearish"
                              ? styles.dirBearish
                              : t.direction === "bullish"
                                ? styles.dirBullish
                                : styles.dirNeutral
                          }
                        >
                          {t.direction === "bearish" ? "↓" : t.direction === "bullish" ? "↑" : "→"}
                        </span>
                        {a}
                      </span>
                    ))}
                  </div>

                  {/* Probability bar */}
                  <div className={styles.probRow}>
                    <div className={styles.probBarWrap}>
                      <div
                        className={`${styles.probBarFill} ${
                          t.probSource === "Polymarket"
                            ? styles.probBarPolymarket
                            : styles.probBarKalshi
                        }`}
                        style={{ width: `${(t.probability * 100).toFixed(0)}%` }}
                      />
                    </div>
                    <span className={styles.probPct}>
                      {(t.probability * 100).toFixed(0)}%
                    </span>
                    <span
                      className={`${styles.confBadge} ${
                        t.confidence === "high"
                          ? styles.confHigh
                          : t.confidence === "medium"
                            ? styles.confMed
                            : styles.confLow
                      }`}
                    >
                      {t.confidence === "high"
                        ? "HIGH CONF"
                        : t.confidence === "medium"
                          ? "MED CONF"
                          : "LOW CONF"}
                    </span>
                  </div>

                  {/* Footer */}
                  <div className={styles.cardFooter}>
                    <div className={styles.footerLeft}>
                      <span
                        className={
                          t.probSource === "Polymarket" ? styles.srcPolymarket : styles.srcKalshi
                        }
                      >
                        {t.probSource} · {fmtVol(t.volume)}
                      </span>
                      <span className={probDeltaClass(t.probDelta)}>
                        {t.probDelta > 0 ? "+" : ""}
                        {(t.probDelta * 100).toFixed(0)}% 24h
                      </span>
                    </div>
                    <span className={styles.cascadeEta}>{t.cascadeEta}</span>
                  </div>
                </article>
              );
            })}
          </div>

          {/* ── CENTER: Heatmap + Detail ── */}
          <div className={styles.colCenter}>
            <div className={styles.sectionHeader}>Sector Risk Heatmap</div>
            <div className={styles.heatmapGrid}>
              {data.sectors.map((s) => {
                const isActive = sectorFilter === s.name;
                const hex = scoreHex(s.score);
                return (
                  <div
                    key={s.name}
                    className={styles.heatmapCell}
                    style={
                      isActive
                        ? {
                            borderColor: `${hex}55`,
                            background: `${hex}0d`,
                          }
                        : {}
                    }
                    onClick={() => handleSectorClick(s.name)}
                  >
                    <div className={styles.heatmapCellLabel}>{s.name}</div>
                    <div className={styles.heatmapScore} style={{ color: hex }}>
                      {s.score}
                    </div>
                    <div className={styles.heatmapCount}>
                      {s.count} active threat{s.count !== 1 ? "s" : ""}
                    </div>
                  </div>
                );
              })}
            </div>

            <div className={styles.sectionHeader}>Threat Detail</div>
            <div className={styles.detailPanel}>
              {!selected ? (
                <div className={styles.detailEmpty}>
                  Select a threat card to view details
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
                    <button
                      type="button"
                      className={styles.closeBtn}
                      onClick={() => setSelected(null)}
                    >
                      ×
                    </button>
                  </div>

                  <div
                    className={styles.detailSummary}
                    style={{
                      borderLeftColor: `${SEVERITY_COLOR[selected.severity] ?? "#3b82f6"}4d`,
                    }}
                  >
                    {selected.summary}
                  </div>

                  <div className={styles.detailGrid}>
                    {/* Probability box */}
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
                                ? "#ef4444"
                                : selected.probDelta < 0
                                  ? "#22c55e"
                                  : "#64748b",
                          }}
                        >
                          {selected.probDelta > 0 ? "▲" : selected.probDelta < 0 ? "▼" : "—"}{" "}
                          {Math.abs(selected.probDelta * 100).toFixed(0)}%
                        </span>
                      </div>
                      <Sparkline
                        data={selected.probHistory}
                        color={selected.probSource === "Polymarket" ? "#5b5fef" : "#10b981"}
                      />
                      <div className={styles.detailBoxSub}>
                        <span
                          className={
                            selected.probSource === "Polymarket"
                              ? styles.srcPolymarket
                              : styles.srcKalshi
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

                    {/* Cascade timeline box */}
                    <div className={styles.detailBox}>
                      <div className={styles.detailBoxLabel}>Cascade Timeline</div>
                      <div className={styles.detailCascadeEta}>{selected.cascadeEta}</div>
                      <div className={styles.detailBoxSub}>estimated market repricing window</div>
                      <div className={styles.riskBar} style={{ marginTop: 8 }}>
                        <div
                          className={styles.riskBarFill}
                          style={{
                            width: "35%",
                            background: scoreHex(40),
                          }}
                        />
                      </div>
                      <div className={styles.pricedInLabel}>~35% priced in</div>
                    </div>
                  </div>

                  {/* Affected assets */}
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
                        }`}
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
                          {selected.direction === "bearish"
                            ? "↓"
                            : selected.direction === "bullish"
                              ? "↑"
                              : "→"}
                        </span>
                        {a}
                      </span>
                    ))}
                  </div>

                  <div className={styles.detailFooter}>
                    <div style={{ fontSize: 10, color: "var(--text-muted)" }}>
                      <span>{selected.sourceCount} sources</span>
                      {" · "}
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
                    <button type="button" className={styles.analyzeBtn}>
                      ⚡ Analyze with AI
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* ── RIGHT: Probabilities + Forces + Sources ── */}
          <div className={styles.colRight}>

            {/* Top Probabilities */}
            <div className={styles.rightSection}>
              <div className={styles.sectionHeader}>Top Probabilities</div>
              {[...data.threats]
                .sort((a, b) => b.probability - a.probability)
                .slice(0, 5)
                .map((t) => (
                  <div key={t.id} className={styles.probRankItem}>
                    <div className={styles.probRankHeader}>
                      <span className={styles.probRankTitle} title={t.title}>
                        {truncateTitle(t.title)}
                      </span>
                      <span className={styles.probRankPct}>
                        {(t.probability * 100).toFixed(0)}%
                      </span>
                    </div>
                    <div className={styles.probRankBar}>
                      <div
                        className={`${styles.probRankBarFill} ${
                          t.probSource === "Polymarket"
                            ? styles.probBarPolymarket
                            : styles.probBarKalshi
                        }`}
                        style={{ width: `${(t.probability * 100).toFixed(0)}%` }}
                      />
                    </div>
                    <div className={styles.probRankMeta}>
                      <span
                        className={
                          t.probSource === "Polymarket" ? styles.srcPolymarket : styles.srcKalshi
                        }
                      >
                        {t.probSource}
                      </span>
                      <span className={probDeltaClass(t.probDelta)}>
                        {t.probDelta > 0 ? "+" : ""}
                        {(t.probDelta * 100).toFixed(0)}% 24h
                      </span>
                    </div>
                  </div>
                ))}
            </div>

            {/* Force Breakdown */}
            <div className={styles.rightSection}>
              <div className={styles.sectionHeader}>Force Breakdown</div>
              {data.forces.map((f) => (
                <div key={f.name} className={styles.forceItem}>
                  <div className={styles.forceHeader}>
                    <span className={styles.forceName}>
                      {f.name}{" "}
                      <span className={styles.forceWeight}>({Math.round(f.weight * 100)}%)</span>
                    </span>
                    <span
                      className={styles.forceScore}
                      style={{ color: scoreHex(f.score) }}
                    >
                      {f.score}/100
                    </span>
                  </div>
                  <div className={styles.forceBar}>
                    <div
                      className={styles.forceBarFill}
                      style={{ width: `${f.score}%`, background: scoreHex(f.score) }}
                    />
                  </div>
                </div>
              ))}
            </div>

            {/* Data Sources */}
            <div className={styles.rightSection}>
              <div className={styles.sectionHeader}>Data Sources</div>
              {Object.entries(data.sourceHealth).map(([name, s]) => {
                const { dot, label } = getSourceDisplay(name, s.state);
                const displayName = SOURCE_DISPLAY[name] ?? name;
                return (
                  <div key={name} className={styles.sourceRow}>
                    <span className={styles.sourceName}>{displayName}</span>
                    <div className={styles.sourceStatusGroup}>
                      <span
                        className={styles.sourceDot}
                        style={{ background: dot }}
                      />
                      <span className={styles.sourceStatusLabel} style={{ color: dot }}>
                        {label}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Disclaimer */}
            <div className={styles.disclaimer}>
              <div className={styles.disclaimerHeader}>Disclaimer</div>
              <div className={styles.disclaimerText}>
                Vigil displays geopolitical event severity data. It is not investment advice.
                Scores represent event conditions, not security recommendations.
              </div>
            </div>
          </div>

        </div>
      )}
    </div>
  );
}
