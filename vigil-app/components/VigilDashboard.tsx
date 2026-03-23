"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { CSSProperties } from "react";

type CSSWithCustomProperties = CSSProperties & Record<string, string>;
import styles from "./VigilDashboard.module.css";
import { UserProfileButton } from "./UserProfileButton";
import { STATIC_ASSET_SECTORS } from "@/lib/asset/staticAssetSectors";

// ── Type inferred from pipeline return ──────────────────────────────────────
type Snapshot = Awaited<ReturnType<typeof import("@/lib/pipeline").buildDashboardSnapshot>>;
type Threat = Snapshot["threats"][0];
type AssetFilter = "all" | "stocks" | "crypto" | "commodities";
type ViewMode = "dashboard" | "portfolio";
type AssetMeta = { name?: string | null; sectors: string[] };

// ── Constants ────────────────────────────────────────────────────────────────
const SEVERITY_COLOR: Record<string, string> = {
  critical: "#c42626",
  high: "#b07028",
  medium: "#2d6eb0",
  low: "#25784a",
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

// Find all threats relevant to an asset — direct mentions + same-sector threats.
function threatsForAsset(
  sym: string,
  allThreats: Threat[],
  sectorsForAsset: string[],
  threatMap: Record<string, Threat[]>
): { direct: Threat[]; related: Threat[] } {
  const s = sym.toUpperCase();
  const direct = threatMap[s] ?? [];
  const directIds = new Set(direct.map((t) => t.id));
  const related =
    sectorsForAsset.length > 0
      ? allThreats.filter((t) => !directIds.has(t.id) && sectorsForAsset.includes(t.sector))
      : [];
  return { direct, related };
}

const SOURCE_DISPLAY: Record<string, string> = {
  polymarket: "Polymarket",
  kalshi: "Kalshi",
  gdelt: "GDELT",
  alphaVantage: "Alpha Vantage",
  coinGecko: "CoinGecko / Coinpaprika",
  usgs: "USGS Earthquakes",
  nasaEonet: "NASA EONET",
  fred: "FRED Macro",
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

// ── Portfolio risk computation (includes sector-level threats) ────────────────
function getAssetRisk(
  sym: string,
  allThreats: Threat[],
  threatMap: Record<string, Threat[]>,
  sectorsForAsset: string[]
) {
  const { direct, related } = threatsForAsset(sym, allThreats, sectorsForAsset, threatMap);
  // Direct threats weight more; related (sector) threats contribute at 50%
  const threats = [...direct, ...related];
  if (!threats.length) {
    return { score: 0, direction: "neutral" as const, count: 0, topThreat: null as string | null, hasRelated: false };
  }
  const scores = threats.map((t) =>
    t.compositeScore ??
    (t.severity === "critical" ? 80 : t.severity === "high" ? 65 : t.severity === "medium" ? 45 : 25)
  );
  const score = Math.min(100, Math.max(...scores.slice(0, direct.length + 1)));
  const bearish = direct.filter((t) => t.direction === "bearish").length;
  const bullish = direct.filter((t) => t.direction === "bullish").length;
  const direction =
    bearish > bullish ? ("bearish" as const) : bullish > bearish ? ("bullish" as const) : ("neutral" as const);
  const sorted = [...direct, ...related].sort((a, b) => (b.compositeScore ?? 0) - (a.compositeScore ?? 0));
  return {
    score,
    direction,
    count: direct.length,
    relatedCount: related.length,
    topThreat: sorted[0]?.title ?? null,
    hasRelated: related.length > 0,
  };
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
  if (name === "gprIndex") return { dot: "#b07028", label: "daily" };
  if (name === "geminiFlash") return { dot: "#4a4845", label: "standby" };
  if (state === "live") return { dot: "#25784a", label: "live" };
  if (state === "stale") return { dot: "#b07028", label: "stale" };
  if (state === "delayed") return { dot: "#b07028", label: "delayed" };
  return { dot: "#c42626", label: "offline" };
}

// ── Main Component ────────────────────────────────────────────────────────────
export default function VigilDashboard() {
  const [data, setData] = useState<Snapshot | null>(null);
  const [selected, setSelected] = useState<Threat | null>(null);
  const [assetFilter, setAssetFilter] = useState<AssetFilter>("all");
  const [sectorFilter, setSectorFilter] = useState<string | null>(null);
  const [clock, setClock] = useState<Date>(new Date());
  const [view, setView] = useState<ViewMode>("dashboard");
  const [assetSearch, setAssetSearch] = useState("");
  // Always start empty on server + first client paint so SSR/CSR match; hydrate from localStorage in useEffect.
  const [portfolio, setPortfolio] = useState<string[]>([]);
  const [assetMetaBySym, setAssetMetaBySym] = useState<Record<string, AssetMeta>>({});
  const assetMetaRequestedRef = useRef<Set<string>>(new Set());
  /** After mount: portfolio loaded from localStorage and clock may diverge from server. */
  const [clientUiReady, setClientUiReady] = useState(false);
  const [portfolioSearch, setPortfolioSearch] = useState("");
  const [showDrop, setShowDrop] = useState(false);
  const dropRef = useRef<HTMLDivElement>(null);

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

  // Hydrate portfolio from localStorage + enable client-only UI (clock, counts) without hydration mismatch
  useEffect(() => {
    try {
      const raw = localStorage.getItem("vigil-portfolio");
      if (raw) {
        const parsed = JSON.parse(raw) as string[];
        setPortfolio(parsed);
      }
    } catch {
      /* ignore corrupt storage */
    }
    setClientUiReady(true);
  }, []);

  // Fetch asset metadata (name + sector mapping) for portfolio tickers so risk isn't limited
  // to only the hardcoded subset.
  useEffect(() => {
    if (!portfolio.length) return;

    const uniqueSyms = Array.from(new Set(portfolio.map((s) => s.toUpperCase())));
    const toFetch = uniqueSyms.filter((sym) => {
      if (STATIC_ASSET_SECTORS[sym]) return false; // already covered statically
      if (assetMetaBySym[sym]?.sectors?.length) return false;
      if (assetMetaRequestedRef.current.has(sym)) return false;
      return true;
    });

    if (!toFetch.length) return;

    toFetch.forEach((sym) => assetMetaRequestedRef.current.add(sym));

    const controller = new AbortController();
    let alive = true;

    void (async () => {
      for (const sym of toFetch) {
        try {
          const res = await fetch(`/api/asset/lookup?symbol=${encodeURIComponent(sym)}`, {
            cache: "no-store",
            signal: controller.signal,
          });
          const json = (await res.json()) as { ok?: boolean; name?: string | null; sectors?: string[] };
          if (!alive) return;

          if (json.ok && Array.isArray(json.sectors)) {
            setAssetMetaBySym((prev) => ({ ...prev, [sym]: { name: json.name ?? null, sectors: json.sectors } }));
          } else {
            setAssetMetaBySym((prev) => ({ ...prev, [sym]: { name: json.name ?? null, sectors: STATIC_ASSET_SECTORS[sym] ?? [] } }));
          }
        } catch {
          // ignore network errors; we will keep the card but with whatever static fallback we have
        }
      }
    })();

    return () => {
      alive = false;
      controller.abort();
    };
  }, [portfolio, assetMetaBySym]);

  // Persist portfolio to localStorage (only after initial hydrate so we do not wipe saved data with [])
  useEffect(() => {
    if (!clientUiReady) return;
    localStorage.setItem("vigil-portfolio", JSON.stringify(portfolio));
  }, [portfolio, clientUiReady]);

  // Close search dropdown when clicking outside
  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (dropRef.current && !dropRef.current.contains(e.target as Node)) {
        setShowDrop(false);
      }
    }
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, []);

  // Portfolio actions
  const addToPortfolio = useCallback(
    (sym: string) => {
      const s = sym.toUpperCase().trim();
      if (!s) return;
      setPortfolio((p) => (p.includes(s) ? p : [...p, s]));
      setPortfolioSearch("");
      setShowDrop(false);
    },
    []
  );

  const removeFromPortfolio = useCallback((sym: string) => {
    setPortfolio((p) => p.filter((s) => s !== sym));
  }, []);

  // Threats indexed by asset symbol
  const threatsByAsset = useMemo(() => {
    if (!data) return {} as Record<string, Threat[]>;
    const m: Record<string, Threat[]> = {};
    for (const t of data.threats) {
      for (const a of t.assets) {
        (m[a] ??= []).push(t);
      }
    }
    return m;
  }, [data]);

  // All asset symbols known to the system
  const allKnownAssets = useMemo(() => {
    if (!data) return [] as string[];
    const s = new Set<string>();
    data.threats.forEach((t) => t.assets.forEach((a) => s.add(a)));
    (data.tickers ?? []).forEach((t) => s.add(t.sym));
    return [...s].sort();
  }, [data]);

  // Autocomplete suggestions for portfolio add
  const searchSuggestions = useMemo(() => {
    if (!portfolioSearch.trim()) return [] as string[];
    const q = portfolioSearch.toUpperCase();
    return allKnownAssets.filter((a) => a.toUpperCase().includes(q)).slice(0, 6);
  }, [allKnownAssets, portfolioSearch]);

  // Threats filtered to portfolio assets
  const portfolioThreats = useMemo(() => {
    if (!data) return [] as Threat[];
    if (!portfolio.length) return [] as Threat[];
    return data.threats.filter((t) => t.assets.some((a) => portfolio.includes(a)));
  }, [data, portfolio]);

  // Visible threats in left column
  const { visibleThreats, searchMode } = useMemo(() => {
    if (!data) return { visibleThreats: [] as Threat[], searchMode: "none" as const };
    if (view === "portfolio") return { visibleThreats: portfolioThreats, searchMode: "none" as const };

    const q = assetSearch.trim().toUpperCase();

    if (q) {
      const sectorsForAsset = assetMetaBySym[q]?.sectors ?? STATIC_ASSET_SECTORS[q] ?? [];
      const { direct, related } = threatsForAsset(q, data.threats, sectorsForAsset, threatsByAsset);
      if (direct.length > 0 || related.length > 0) {
        // Show direct first, then related sector threats
        const merged = [...direct, ...related.filter(t => !direct.some(d => d.id === t.id))];
        return {
          visibleThreats: merged,
          searchMode: direct.length > 0 && related.length > 0
            ? "mixed"
            : direct.length > 0 ? "direct" : "sector",
        } as const;
      }
      // No match at all — show all threats (nothing to filter)
      return { visibleThreats: data.threats, searchMode: "none" as const };
    }

    let list = data.threats;
    if (assetFilter !== "all") {
      const secs = ASSET_SECTORS[assetFilter];
      list = list.filter((t) => secs.includes(t.sector));
    }
    if (sectorFilter) {
      list = list.filter((t) => t.sector === sectorFilter);
    }
    return { visibleThreats: list, searchMode: "none" as const };
  }, [data, assetFilter, sectorFilter, view, portfolioThreats, assetSearch, threatsByAsset, assetMetaBySym]);

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

  const timeStr = clientUiReady
    ? clock.toLocaleTimeString("en-US", {
        hour12: false,
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
      })
    : "--:--:--";

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
        {/* User profile in top-right of ticker bar */}
        <div style={{ display: "flex", alignItems: "center", padding: "0 12px", flexShrink: 0 }}>
          <UserProfileButton />
        </div>
      </div>

      {/* ─── METRIC ROW ─── */}
      <div className={styles.metricRow}>
        <div className={styles.metricCard}>
          <div className={styles.metricLabel}>Active Threats</div>
          <div className={styles.metricValue}>{data?.threats.length ?? "—"}</div>
          <div className={styles.metricSub}>across {categories} categories</div>
        </div>

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

        <div className={styles.metricCard}>
          <div className={styles.metricLabel}>GPR Index</div>
          <div className={styles.metricValue}>{gpr}</div>
          <div className={styles.metricSub}>{gpr >= 180 ? "(elevated)" : "(normal)"}</div>
        </div>

        <div className={styles.metricCard}>
          <div className={styles.metricLabel}>
            {view === "portfolio" ? "Portfolio Positions" : "Assets at Risk"}
          </div>
          <div className={styles.metricValue}>
            {view === "portfolio" ? portfolio.length || "—" : allAssets.length || "—"}
          </div>
          <div className={styles.metricSub}>
            {view === "portfolio"
              ? portfolio.length
                ? `${portfolioThreats.length} active threat${portfolioThreats.length !== 1 ? "s" : ""}`
                : "no positions tracked"
              : topAssets || "loading…"}
          </div>
        </div>
      </div>

      {/* ─── FILTER BAR ─── */}
      <div className={styles.filterBar}>
        {/* View + asset filter pills */}
        {view === "dashboard" &&
          (["all", "stocks", "crypto", "commodities"] as AssetFilter[]).map((f) => (
            <button
              key={f}
              type="button"
              onClick={() => {
                setAssetFilter(f);
                setSectorFilter(null);
                setAssetSearch("");
              }}
              className={`${styles.filterPill} ${assetFilter === f && !assetSearch ? styles.filterPillActive : ""}`}
            >
              {f.charAt(0).toUpperCase() + f.slice(1)}
            </button>
          ))}

        <button
          type="button"
          onClick={() => {
            setView((v) => (v === "portfolio" ? "dashboard" : "portfolio"));
            setSelected(null);
          }}
          className={`${styles.filterPill} ${view === "portfolio" ? styles.filterPillActive : ""}`}
        >
          Portfolio{portfolio.length > 0 ? ` (${portfolio.length})` : ""}
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

        {/* Asset search */}
        <div className={`${styles.filterSearch} ${assetSearch ? styles.filterSearchActive : ""}`}>
          <span className={styles.filterSearchIcon}>⌕</span>
          <input
            className={styles.filterSearchInput}
            placeholder="Search asset…"
            value={assetSearch}
            onChange={(e) => {
              setAssetSearch(e.target.value);
              if (view === "portfolio") setView("dashboard");
            }}
          />
          {assetSearch && (
            <button
              type="button"
              className={styles.filterSearchClear}
              onClick={() => setAssetSearch("")}
            >
              ×
            </button>
          )}
        </div>

        <div className={styles.filterRight}>
          <span className={styles.liveDot} />
          <span>LIVE</span>
          <span>{timeStr}</span>
          <span>
            {view === "portfolio" && portfolio.length
              ? `${portfolioThreats.length} THREATS`
              : `${visibleThreats.length} THREATS`}
          </span>
        </div>
      </div>

      {/* ─── COLUMNS ─── */}
      {!data ? (
        <div className={styles.loadingOverlay}>Initializing intelligence feed…</div>
      ) : (
        <div className={styles.columns}>

          {/* ── LEFT: Threat Feed ── */}
          <div className={styles.colLeft}>
            <div className={styles.sectionHeader}>
              {view === "portfolio"
                ? portfolio.length
                  ? "Portfolio Threat Exposure"
                  : "Live Threat Feed"
                : assetSearch
                  ? searchMode === "sector"
                    ? `Sector Threats · ${assetSearch.toUpperCase()}`
                    : searchMode === "mixed"
                      ? `All Threats · ${assetSearch.toUpperCase()}`
                      : `Threats · ${assetSearch.toUpperCase()}`
                  : "Live Threat Feed"}
            </div>

            {visibleThreats.length === 0 && (
              <div style={{ color: "var(--text-muted)", fontSize: 12, textAlign: "center", padding: "24px 0" }}>
                {view === "portfolio"
                  ? portfolio.length
                    ? "No active threats affecting your portfolio"
                    : "Add positions to the Portfolio tab to see their threat exposure"
                  : "No threats match current filters"}
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

                  <div className={styles.threatTitle}>{t.title}</div>

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
                        } ${portfolio.includes(a) ? styles.assetChipInPortfolio : ""}`}
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
                        {portfolio.includes(a) && (
                          <span className={styles.assetChipPortfolioMark}>●</span>
                        )}
                      </span>
                    ))}
                  </div>

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

          {/* ── CENTER: Portfolio Panel or Heatmap + Detail ── */}
          <div className={styles.colCenter}>
            {view === "portfolio" ? (
              /* ── Portfolio Panel ── */
              <>
                <div className={styles.sectionHeader}>Portfolio Monitor</div>

                {/* Add ticker search */}
                <div className={styles.portfolioSearchRow} ref={dropRef}>
                  <input
                    className={styles.portfolioInput}
                    placeholder="Add ticker or asset  (BTC, NVDA, GOLD, SPY…)"
                    value={portfolioSearch}
                    onChange={(e) => {
                      setPortfolioSearch(e.target.value);
                      setShowDrop(true);
                    }}
                    onFocus={() => setShowDrop(true)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && portfolioSearch.trim()) {
                        addToPortfolio(portfolioSearch);
                      }
                      if (e.key === "Escape") setShowDrop(false);
                    }}
                  />
                  {portfolioSearch.trim() && (
                    <button
                      type="button"
                      className={styles.portfolioAddBtn}
                      onClick={() => addToPortfolio(portfolioSearch)}
                    >
                      + Add
                    </button>
                  )}

                  {/* Autocomplete dropdown */}
                  {showDrop && searchSuggestions.length > 0 && (
                    <div className={styles.searchDropdown}>
                      {searchSuggestions.map((s) => (
                        <button
                          key={s}
                          type="button"
                          className={styles.searchDropdownItem}
                          onMouseDown={(e) => {
                            e.preventDefault();
                            addToPortfolio(s);
                          }}
                        >
                          <span className={styles.searchDropdownSym}>{s}</span>
                          {portfolio.includes(s) ? (
                            <span className={styles.searchDropdownStatus}>Watching</span>
                          ) : (
                            <>
                              <span className={styles.searchDropdownThreats}>
                                {(() => {
                                  const sym = s.toUpperCase();
                                  const meta = assetMetaBySym[sym];
                                  const sectorsForAsset =
                                    meta?.sectors?.length
                                      ? meta.sectors
                                      : STATIC_ASSET_SECTORS[sym] ?? ["Technology"];
                                  const risk = getAssetRisk(sym, data.threats, threatsByAsset, sectorsForAsset);
                                  return risk.count > 0
                                    ? `${risk.count} direct${risk.hasRelated ? ` · ${risk.relatedCount} sector` : ""}`
                                    : risk.hasRelated
                                      ? `${risk.relatedCount} sector threats`
                                      : "no threats";
                                })()}
                              </span>
                              <span className={styles.searchDropdownAdd}>+ Add</span>
                            </>
                          )}
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                {/* Portfolio cards */}
                {portfolio.length === 0 ? (
                  <div className={styles.portfolioEmpty}>
                    <div className={styles.portfolioEmptyIcon}>◎</div>
                    <div>Add tickers above to monitor their geopolitical risk exposure.</div>
                    <div style={{ marginTop: 6, fontSize: 10 }}>
                      Threats from the feed automatically map to your positions.
                    </div>
                  </div>
                ) : (
                  <div className={styles.portfolioGrid}>
                    {portfolio.map((sym) => {
                      const meta = assetMetaBySym[sym];
                      const sectorsForAsset =
                        meta?.sectors?.length
                          ? meta.sectors
                          : STATIC_ASSET_SECTORS[sym] ?? ["Technology"];
                      const risk = getAssetRisk(sym, data.threats, threatsByAsset, sectorsForAsset);
                      const assetName = meta?.name ?? null;
                      const borderColor = risk.score > 0 ? scoreHex(risk.score) : "rgba(255,255,255,0.07)";
                      return (
                        <div
                          key={sym}
                          className={styles.portfolioCard}
                          style={{ borderLeftColor: borderColor }}
                        >
                          <div className={styles.portfolioCardHeader}>
                            <div style={{ display: "flex", flexDirection: "column" }}>
                              <span className={styles.portfolioCardTicker}>{sym}</span>
                              {assetName && <div className={styles.portfolioCardTickerName}>{assetName}</div>}
                            </div>
                            <button
                              type="button"
                              className={styles.portfolioCardRemove}
                              onClick={() => removeFromPortfolio(sym)}
                              title="Remove from portfolio"
                            >
                              ×
                            </button>
                          </div>

                          <div
                            className={styles.portfolioCardScore}
                            style={{ color: risk.score > 0 ? scoreHex(risk.score) : "var(--text-muted)" }}
                          >
                            {risk.score > 0 ? Math.round(risk.score) : "—"}
                            <span className={styles.portfolioCardScoreUnit}>/100</span>
                          </div>

                          <div className={styles.portfolioCardMeta}>
                            <span
                              className={
                                risk.direction === "bearish"
                                  ? styles.dirBearish
                                  : risk.direction === "bullish"
                                    ? styles.dirBullish
                                    : styles.dirNeutral
                              }
                            >
                              {risk.direction === "bearish"
                                ? "↓ bearish"
                                : risk.direction === "bullish"
                                  ? "↑ bullish"
                                  : "→ neutral"}
                            </span>
                            <span className={styles.portfolioCardCount}>
                              {risk.count > 0
                                ? `${risk.count} direct${risk.hasRelated ? ` · ${risk.relatedCount} sector` : ""}`
                                : risk.hasRelated
                                  ? `${risk.relatedCount} sector threats`
                                  : "no threats"}
                            </span>
                          </div>

                          {risk.topThreat && (
                            <div className={styles.portfolioCardTopThreat} title={risk.topThreat}>
                              {risk.topThreat.length > 40
                                ? `${risk.topThreat.slice(0, 40)}…`
                                : risk.topThreat}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </>
            ) : (
              /* ── Sector Heatmap ── */
              <>
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
                            ? ({
                                borderColor: `${hex}55`,
                                background: `${hex}0d`,
                                "--cell-glow": `${hex}18`,
                              } as CSSWithCustomProperties)
                            : ({
                                "--cell-glow": `${hex}0a`,
                              } as CSSWithCustomProperties)
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
              </>
            )}

            {/* Threat detail — always visible in center column */}
            <div className={styles.sectionHeader} style={{ marginTop: view === "portfolio" ? 14 : 0 }}>
              Threat Detail
            </div>
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
                          {selected.direction === "bearish"
                            ? "↓"
                            : selected.direction === "bullish"
                              ? "↑"
                              : "→"}
                        </span>
                        {a}
                        {portfolio.includes(a) && (
                          <span className={styles.assetChipPortfolioMark}>●</span>
                        )}
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
                    <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                      {/* Add all threat assets to portfolio */}
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
          </div>

          {/* ── RIGHT: Probabilities + Forces + Sources ── */}
          <div className={styles.colRight}>

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

            <div className={styles.rightSection}>
              <div className={styles.sectionHeader}>Force Breakdown</div>
              {data.forces.map((f) => (
                <div key={f.name} className={styles.forceItem}>
                  <div className={styles.forceHeader}>
                    <span className={styles.forceName}>
                      {f.name}{" "}
                      <span className={styles.forceWeight}>({Math.round(f.weight * 100)}%)</span>
                    </span>
                    <span className={styles.forceScore} style={{ color: scoreHex(f.score) }}>
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
                        className={`${styles.sourceDot} ${s.state === "live" ? styles.sourceDotLive : ""}`}
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
