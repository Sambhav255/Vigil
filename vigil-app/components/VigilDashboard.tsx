"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import styles from "./VigilDashboard.module.css";
import type { CSSWithCustomProperties } from "./dashboard/shared";
import ErrorBoundary from "./ErrorBoundary";
import { STATIC_ASSET_SECTORS } from "@/lib/asset/staticAssetSectors";
import TickerBar from "./dashboard/TickerBar";
import MetricRow from "./dashboard/MetricRow";
import FilterBar from "./dashboard/FilterBar";
import ThreatCard from "./dashboard/ThreatCard";
import SectorHeatmap from "./dashboard/SectorHeatmap";
import DetailPanel from "./dashboard/DetailPanel";
import RightPanel from "./dashboard/RightPanel";
import PortfolioView from "./dashboard/PortfolioView";

// ── Type inferred from pipeline return ──────────────────────────────────────
type Snapshot = Awaited<ReturnType<typeof import("@/lib/pipeline").buildDashboardSnapshot>>;
type Threat = Snapshot["threats"][0];
type AssetFilter = "all" | "stocks" | "crypto" | "commodities";
type ViewMode = "dashboard" | "portfolio";
type AssetMeta = { name?: string | null; sectors: string[] };

// ── Constants ────────────────────────────────────────────────────────────────
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
    return {
      score: 0,
      direction: "neutral" as const,
      count: 0,
      relatedCount: 0,
      topThreat: null as string | null,
      hasRelated: false,
    };
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
  const SEVERITY_RANK = { critical: 4, high: 3, medium: 2, low: 1 } as const;
  const sorted = [...direct, ...related].sort((a, b) => {
    const sevDiff = (SEVERITY_RANK[b.severity] ?? 0) - (SEVERITY_RANK[a.severity] ?? 0);
    if (sevDiff !== 0) return sevDiff;
    return (b.compositeScore ?? 0) - (a.compositeScore ?? 0);
  });
  return {
    score,
    direction,
    count: direct.length,
    relatedCount: related.length,
    topThreat: sorted[0]?.title ?? null,
    hasRelated: related.length > 0,
  };
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
  const [mobileTab, setMobileTab] = useState<"feed" | "detail" | "intel">("feed");
  const dropRef = useRef<HTMLDivElement>(null);
  const [changedThreats, setChangedThreats] = useState<Record<number, "new" | "prob" | "sev">>({});
  const prevThreatByIdRef = useRef<Map<number, Threat>>(new Map());
  const [notificationsEnabled, setNotificationsEnabled] = useState(false);
  const notificationsEnabledRef = useRef(notificationsEnabled);
  const [isDataStale, setIsDataStale] = useState(true);

  useEffect(() => {
    notificationsEnabledRef.current = notificationsEnabled;
  }, [notificationsEnabled]);

  // On mobile: if a 15s poll clears `selected` while on the Detail tab, return to Feed.
  useEffect(() => {
    if (!selected && mobileTab === "detail") setMobileTab("feed");
  }, [selected, mobileTab]);

  // Fetch data every 15 s
  useEffect(() => {
    let alive = true;
    const load = async () => {
      setIsDataStale(true);
      try {
        const res = await fetch("/api/dashboard", { cache: "no-store" });
        const json = (await res.json()) as Snapshot;
        if (alive) {
          const previous = prevThreatByIdRef.current;
          const next = new Map<number, Threat>();
          const delta: Record<number, "new" | "prob" | "sev"> = {};

          for (const t of json.threats) {
            next.set(t.id, t);
            const prev = previous.get(t.id);
            if (!prev) {
              delta[t.id] = "new";
              continue;
            }
            if (t.severity !== prev.severity) {
              delta[t.id] = "sev";
              continue;
            }
            if (Math.abs(t.probability - prev.probability) > 0.02) {
              delta[t.id] = "prob";
            }

            if (
              notificationsEnabledRef.current &&
              typeof window !== "undefined" &&
              "Notification" in window &&
              Notification.permission === "granted"
            ) {
              const prevScore = prev.compositeScore ?? 0;
              const nextScore = t.compositeScore ?? 0;
              if (prevScore < 70 && nextScore >= 70) {
                new Notification(`Vigil Alert: ${t.title}`, {
                  body: `${Math.round(nextScore)}/100 risk · ${(t.probability * 100).toFixed(0)}% probability`,
                });
              }
            }
          }

          prevThreatByIdRef.current = next;
          setChangedThreats(delta);
          setData(json);
          setIsDataStale(false);
        }
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

  useEffect(() => {
    if (!Object.keys(changedThreats).length) return;
    const id = setTimeout(() => setChangedThreats({}), 5000);
    return () => clearTimeout(id);
  }, [changedThreats]);

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
      const notif = localStorage.getItem("vigil-notifications-enabled");
      if (notif === "true") setNotificationsEnabled(true);
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
            const sectors = json.sectors;
            setAssetMetaBySym((prev) => ({ ...prev, [sym]: { name: json.name ?? null, sectors } }));
          } else {
            setAssetMetaBySym((prev) => ({
              ...prev,
              [sym]: { name: json.name ?? null, sectors: STATIC_ASSET_SECTORS[sym] ?? [] },
            }));
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

  useEffect(() => {
    if (!clientUiReady) return;
    localStorage.setItem("vigil-notifications-enabled", notificationsEnabled ? "true" : "false");
  }, [notificationsEnabled, clientUiReady]);

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

  const reorderPortfolio = useCallback((fromIdx: number, toIdx: number) => {
    setPortfolio((p) => {
      if (fromIdx < 0 || toIdx < 0 || fromIdx >= p.length || toIdx >= p.length || fromIdx === toIdx) {
        return p;
      }
      const next = [...p];
      const [moved] = next.splice(fromIdx, 1);
      next.splice(toIdx, 0, moved);
      return next;
    });
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

  // Autocomplete suggestions: known assets filtered locally, plus remote lookup for unknowns
  const [lookupSuggestion, setLookupSuggestion] = useState<string | null>(null);
  useEffect(() => {
    const q = portfolioSearch.trim().toUpperCase();
    if (!q || allKnownAssets.some((a) => a.toUpperCase().includes(q))) {
      setLookupSuggestion(null);
      return;
    }
    const timer = setTimeout(async () => {
      try {
        const res = await fetch(`/api/asset/lookup?symbol=${encodeURIComponent(q)}`, { cache: "no-store" });
        const json = (await res.json()) as { ok: boolean; symbol: string };
        if (json.ok) setLookupSuggestion(json.symbol);
      } catch {
        // network error — ignore
      }
    }, 350);
    return () => clearTimeout(timer);
  }, [portfolioSearch, allKnownAssets]);

  const searchSuggestions = useMemo(() => {
    if (!portfolioSearch.trim()) return [] as string[];
    const q = portfolioSearch.toUpperCase();
    const local = allKnownAssets.filter((a) => a.toUpperCase().includes(q)).slice(0, 6);
    if (lookupSuggestion && !local.includes(lookupSuggestion)) {
      return [...local, lookupSuggestion].slice(0, 6);
    }
    return local;
  }, [allKnownAssets, portfolioSearch, lookupSuggestion]);

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
    setSelected((prev) => {
      const next = prev?.id === t.id ? null : t;
      // auto-switch tab: Detail when selecting, Feed when deselecting (toggle)
      setMobileTab(next ? "detail" : "feed");
      return next;
    });
  }, []);

  const handleRightPanelThreatSelect = useCallback((t: Threat) => {
    setSelected(t);
    setMobileTab("detail");
  }, []);

  const handleSectorClick = useCallback((sector: string) => {
    setSectorFilter((prev) => (prev === sector ? null : sector));
  }, []);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      const tag = target?.tagName?.toLowerCase();
      const typing =
        tag === "input" || tag === "textarea" || tag === "select" || !!target?.isContentEditable;
      if (typing && e.key !== "Escape") return;

      if (e.key === "j") {
        e.preventDefault();
        if (!visibleThreats.length) return;
        const idx = selected ? visibleThreats.findIndex((t) => t.id === selected.id) : -1;
        const next = visibleThreats[Math.min(visibleThreats.length - 1, idx + 1)] ?? visibleThreats[0];
        setSelected(next);
      } else if (e.key === "k") {
        e.preventDefault();
        if (!visibleThreats.length) return;
        const idx = selected ? visibleThreats.findIndex((t) => t.id === selected.id) : 0;
        const next = visibleThreats[Math.max(0, idx - 1)] ?? visibleThreats[0];
        setSelected(next);
      } else if (e.key === "Enter") {
        if (!selected && visibleThreats.length) setSelected(visibleThreats[0]);
      } else if (e.key === "Escape") {
        e.preventDefault();
        setSelected(null);
        setAssetSearch("");
        setShowDrop(false);
      } else if (e.key === "1") {
        e.preventDefault();
        setView("dashboard");
        setAssetFilter("all");
      } else if (e.key === "2") {
        e.preventDefault();
        setView("dashboard");
        setAssetFilter("stocks");
      } else if (e.key === "3") {
        e.preventDefault();
        setView("dashboard");
        setAssetFilter("crypto");
      } else if (e.key === "4") {
        e.preventDefault();
        setView("dashboard");
        setAssetFilter("commodities");
      } else if (e.key.toLowerCase() === "p") {
        e.preventDefault();
        setView((v) => (v === "portfolio" ? "dashboard" : "portfolio"));
      } else if (e.key === "/") {
        e.preventDefault();
        const input = document.querySelector<HTMLInputElement>(`input.${styles.filterSearchInput}`);
        input?.focus();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [visibleThreats, selected]);

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
  const criticalThreatCount = useMemo(
    () => data?.threats.filter((t) => t.severity === "critical").length ?? 0,
    [data]
  );
  const highThreatCount = useMemo(
    () => data?.threats.filter((t) => t.severity === "high").length ?? 0,
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
      <TickerBar tickerSet={tickerSet} />

      {/* ─── METRIC ROW ─── */}
      {!data ? (
        <div className={styles.metricRow} aria-hidden="true">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className={styles.metricCard}>
              <div
                className={styles.skeletonShimmer}
                style={{ width: "60%", height: 10, marginBottom: 10, borderRadius: 6 }}
              />
              <div className={styles.skeletonShimmer} style={{ width: "80%", height: 24, borderRadius: 6 }} />
              <div
                className={styles.skeletonShimmer}
                style={{ width: "55%", height: 10, marginTop: 10, borderRadius: 6 }}
              />
              <div
                className={styles.skeletonShimmer}
                style={{ width: "90%", height: 2, marginTop: 8, borderRadius: 999 }}
              />
            </div>
          ))}
        </div>
      ) : (
        <MetricRow
          view={view}
          activeThreatsCount={data?.threats.length ?? null}
          categoriesCount={categories}
          globalRisk={risk}
          gprIndex={gpr}
          portfolioLength={portfolio.length}
          portfolioThreatsCount={portfolioThreats.length}
          allAssetsLength={allAssets.length}
          topAssets={topAssets}
          criticalThreatCount={criticalThreatCount}
          highThreatCount={highThreatCount}
        />
      )}

      {/* ─── FILTER BAR ─── */}
      <FilterBar
        view={view}
        assetFilter={assetFilter}
        setAssetFilter={(f) => {
          setAssetFilter(f);
          setSectorFilter(null);
          setAssetSearch("");
        }}
        sectorFilter={sectorFilter}
        setSectorFilter={setSectorFilter}
        assetSearch={assetSearch}
        onAssetSearchChange={(value) => {
          setAssetSearch(value);
          if (view === "portfolio") setView("dashboard");
        }}
        onTogglePortfolioView={() => {
          setView((v) => (v === "portfolio" ? "dashboard" : "portfolio"));
          setSelected(null);
        }}
        timeStr={timeStr}
        viewThreatCount={visibleThreats.length}
        portfolioLength={portfolio.length}
        portfolioThreatsCount={portfolioThreats.length}
        notificationsEnabled={notificationsEnabled}
        onToggleNotifications={async () => {
          if (typeof window === "undefined" || !("Notification" in window)) return;
          if (!notificationsEnabled) {
            const permission = await Notification.requestPermission();
            if (permission !== "granted") return;
          }
          setNotificationsEnabled((v) => !v);
        }}
        isStale={isDataStale}
      />

      {/* ─── COLUMNS ─── */}
      {!data ? (
        <div className={styles.columns} aria-hidden="true">
          {/* ── LEFT: skeleton threat cards ── */}
          <div className={styles.colLeft}>
            <div className={styles.sectionHeader}>
              <div className={styles.skeletonShimmer} style={{ width: "70%", height: 10, borderRadius: 6 }} />
            </div>
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className={styles.skeletonCard}>
                <div
                  className={styles.skeletonShimmer}
                  style={{ width: "40%", height: 10, marginBottom: 10, borderRadius: 6 }}
                />
                <div
                  className={styles.skeletonShimmer}
                  style={{ width: "88%", height: 16, marginBottom: 12, borderRadius: 6 }}
                />
                <div
                  className={styles.skeletonShimmer}
                  style={{ width: "75%", height: 10, marginBottom: 8, borderRadius: 6 }}
                />
                <div
                  className={styles.skeletonShimmer}
                  style={{ width: "90%", height: 3, borderRadius: 999 }}
                />
              </div>
            ))}
          </div>

          {/* ── CENTER: skeleton heatmap + detail ── */}
          <div className={styles.colCenter}>
            <div className={styles.sectionHeader}>
              <div className={styles.skeletonShimmer} style={{ width: "78%", height: 10, borderRadius: 6 }} />
            </div>
            <div className={styles.heatmapGrid}>
              {Array.from({ length: 6 }).map((_, i) => (
                <div
                  key={i}
                  className={styles.heatmapCell}
                  style={{ ["--cell-glow"]: "rgba(113,113,122,0.45)" } as CSSWithCustomProperties}
                >
                  <div
                    className={styles.skeletonShimmer}
                    style={{ width: "65%", height: 10, marginBottom: 10, borderRadius: 6 }}
                  />
                  <div
                    className={styles.skeletonShimmer}
                    style={{ width: "55%", height: 26, marginBottom: 10, borderRadius: 6 }}
                  />
                  <div
                    className={styles.skeletonShimmer}
                    style={{ width: "75%", height: 10, borderRadius: 6 }}
                  />
                </div>
              ))}
            </div>

            <div className={styles.sectionHeader}>
              <div className={styles.skeletonShimmer} style={{ width: "45%", height: 10, borderRadius: 6 }} />
            </div>
            <div className={styles.detailPanel}>
              <div
                className={styles.skeletonShimmer}
                style={{ width: "80%", height: 18, borderRadius: 6, marginBottom: 10 }}
              />
              <div
                className={styles.skeletonShimmer}
                style={{ width: "55%", height: 12, borderRadius: 6, marginBottom: 12 }}
              />
              <div
                className={styles.skeletonShimmer}
                style={{ width: "100%", height: 70, borderRadius: 8 }}
              />
            </div>
          </div>

          {/* ── RIGHT: skeleton force/source blocks ── */}
          <div className={styles.colRight}>
            <div className={styles.rightSection}>
              <div className={styles.sectionHeader}>
                <div className={styles.skeletonShimmer} style={{ width: "65%", height: 10, borderRadius: 6 }} />
              </div>
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className={styles.skeletonCard} style={{ padding: 10, marginBottom: 10 }}>
                  <div
                    className={styles.skeletonShimmer}
                    style={{ width: "80%", height: 10, marginBottom: 10, borderRadius: 6 }}
                  />
                  <div
                    className={styles.skeletonShimmer}
                    style={{ width: "100%", height: 3, borderRadius: 999 }}
                  />
                </div>
              ))}
            </div>
            <div className={styles.rightSection}>
              <div className={styles.sectionHeader}>
                <div className={styles.skeletonShimmer} style={{ width: "55%", height: 10, borderRadius: 6 }} />
              </div>
              <div className={styles.skeletonShimmer} style={{ width: "92%", height: 10, borderRadius: 6 }} />
              <div className={styles.skeletonShimmer} style={{ width: "78%", height: 10, borderRadius: 6, marginTop: 10 }} />
            </div>
          </div>
        </div>
      ) : (
        <div className={styles.columns}>

          {/* ── LEFT: Threat Feed ── */}
          <ErrorBoundary label="Threat feed">
            <div className={`${styles.colLeft} ${mobileTab !== "feed" ? styles.mobileHidden : ""}`}>
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
                <ThreatCard
                  key={t.id}
                  threat={t}
                  isSelected={!!isSelected}
                  portfolio={portfolio}
                  nowMs={clock.getTime()}
                  changedKind={changedThreats[t.id] ?? null}
                  onClick={() => handleThreatClick(t)}
                />
              );
            })}
            </div>
          </ErrorBoundary>

          {/* ── CENTER: Portfolio Panel or Heatmap + Detail ── */}
          <ErrorBoundary label="Threat detail">
            <div className={`${styles.colCenter} ${mobileTab !== "intel" ? styles.mobileHidden : ""}`}>
            {view === "portfolio" ? (
              /* ── Portfolio Panel ── */
              <>
                <PortfolioView
                  portfolio={portfolio}
                  portfolioSearch={portfolioSearch}
                  setPortfolioSearch={setPortfolioSearch}
                  showDrop={showDrop}
                  setShowDrop={setShowDrop}
                  dropRef={dropRef}
                  searchSuggestions={searchSuggestions}
                  assetMetaBySym={assetMetaBySym}
                  getRiskForSym={(sym) => {
                    const meta = assetMetaBySym[sym];
                    const sectorsForAsset =
                      meta?.sectors?.length
                        ? meta.sectors
                        : STATIC_ASSET_SECTORS[sym] ?? ["Technology"];
                    return getAssetRisk(sym, data.threats, threatsByAsset, sectorsForAsset);
                  }}
                  addToPortfolio={addToPortfolio}
                  removeFromPortfolio={removeFromPortfolio}
                  reorderPortfolio={reorderPortfolio}
                  onCardClick={(sym) => {
                    const SRANK = { critical: 4, high: 3, medium: 2, low: 1 } as const;
                    const list = threatsByAsset[sym.toUpperCase()] ?? [];
                    const topThreat = [...list].sort(
                      (a, b) => (SRANK[b.severity] ?? 0) - (SRANK[a.severity] ?? 0)
                    )[0];
                    if (topThreat) {
                      setSelected(topThreat);
                      setView("dashboard");
                    }
                  }}
                />
              </>
            ) : (
              <SectorHeatmap
                sectors={data.sectors}
                sectorFilter={sectorFilter}
                onSelectSector={handleSectorClick}
              />
            )}
            </div>
            <div className={mobileTab !== "detail" ? styles.mobileHidden : ""}>
              <DetailPanel
                key={selected?.id ?? "none"}
                view={view}
                selected={selected}
                portfolio={portfolio}
                onClose={() => {
                  setSelected(null);
                  setMobileTab("feed");
                }}
                addToPortfolio={addToPortfolio}
              />
            </div>
          </ErrorBoundary>

          {/* ── RIGHT: Probabilities + Forces + Sources ── */}
          <ErrorBoundary label="Right panel">
            <div className={mobileTab !== "intel" ? styles.mobileHidden : ""}>
              <RightPanel data={data} onSelectThreat={handleRightPanelThreatSelect} />
            </div>
          </ErrorBoundary>

        </div>
      )}

      {/* ── MOBILE TAB BAR ── */}
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
    </div>
  );
}
