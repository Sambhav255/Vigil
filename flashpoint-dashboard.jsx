import { useState, useEffect, useCallback, useRef } from "react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from "recharts";

// ─── DESIGN SYSTEM ───
const C = {
  bg: "#0B0E17", bgCard: "#111827", bgPanel: "#0F1629",
  border: "#1E293B", borderLight: "#2D3A52",
  critical: "#EF4444", high: "#F59E0B", medium: "#3B82F6", low: "#22C55E",
  criticalBg: "rgba(239,68,68,0.08)", highBg: "rgba(245,158,11,0.06)",
  mediumBg: "rgba(59,130,246,0.06)", lowBg: "rgba(34,197,94,0.05)",
  text: "#E2E8F0", textDim: "#94A3B8", textMuted: "#64748B",
  accent: "#E94560", accentDim: "rgba(233,69,96,0.15)",
  bearish: "#EF4444", bullish: "#22C55E", neutral: "#94A3B8",
  polymarket: "#5B5FEF", kalshi: "#10B981",
};

const severityMap = {
  critical: { color: C.critical, bg: C.criticalBg, label: "CRITICAL" },
  high: { color: C.high, bg: C.highBg, label: "HIGH" },
  medium: { color: C.medium, bg: C.mediumBg, label: "MEDIUM" },
  low: { color: C.low, bg: C.lowBg, label: "LOW" },
};

// ─── SIMULATED DATA ENGINE ───
// In production, these come from Polymarket/Kalshi/GDELT/Alpha Vantage/CoinGecko/GPR Index
const TICKERS = [
  { sym: "SPY", price: 568.42, chg: -0.73, name: "S&P 500" },
  { sym: "QQQ", price: 487.15, chg: -1.12, name: "Nasdaq" },
  { sym: "BTC", price: 87241, chg: 2.34, name: "Bitcoin" },
  { sym: "ETH", price: 3412, chg: 1.87, name: "Ethereum" },
  { sym: "GLD", price: 243.67, chg: 0.95, name: "Gold" },
  { sym: "CL", price: 71.23, chg: -1.54, name: "Crude Oil" },
  { sym: "TSLA", price: 178.90, chg: -2.41, name: "Tesla" },
  { sym: "NVDA", price: 124.56, chg: -1.89, name: "NVIDIA" },
];

const THREATS = [
  {
    id: 1, title: "Taiwan Strait Military Escalation",
    category: "Geopolitical", severity: "critical",
    assets: ["NVDA", "TSM", "AAPL", "QQQ"], direction: "bearish",
    probability: 0.23, probSource: "Polymarket", probDelta: +0.08, confidence: "medium",
    volume: 84200, cascadeEta: "2-5 days", momentum: "escalating",
    summary: "PLA naval exercises expanded to include live-fire drills within 12nm of Taiwan. Multiple carrier groups repositioned. Semiconductor supply chain at direct risk.",
    sector: "Technology", verified: true, sourceCount: 4,
    probHistory: [0.12, 0.14, 0.15, 0.18, 0.19, 0.21, 0.23],
  },
  {
    id: 2, title: "Federal Reserve Emergency Rate Decision",
    category: "Macroeconomic", severity: "high",
    assets: ["SPY", "QQQ", "TLT", "DXY"], direction: "bearish",
    probability: 0.41, probSource: "Kalshi", probDelta: +0.12, confidence: "high",
    volume: 312000, cascadeEta: "3-7 days", momentum: "escalating",
    summary: "Unexpected CPI print at 5.2% has triggered emergency FOMC discussion. Kalshi pricing 41% chance of inter-meeting rate hike. Bond yields spiking.",
    sector: "Finance", verified: true, sourceCount: 7,
    probHistory: [0.22, 0.25, 0.29, 0.31, 0.35, 0.38, 0.41],
  },
  {
    id: 3, title: "EU Comprehensive Crypto Regulation",
    category: "Regulatory", severity: "high",
    assets: ["BTC", "ETH", "COIN", "MSTR"], direction: "bearish",
    probability: 0.67, probSource: "Polymarket", probDelta: -0.03, confidence: "high",
    volume: 156000, cascadeEta: "1-3 weeks", momentum: "peaking",
    summary: "MiCA Phase 3 enforcement timeline accelerated. Stablecoin reserve requirements exceed market expectations. Exchange compliance costs estimated at $50M+.",
    sector: "Crypto", verified: true, sourceCount: 5,
    probHistory: [0.58, 0.62, 0.65, 0.68, 0.70, 0.69, 0.67],
  },
  {
    id: 4, title: "Gulf of Aden Shipping Route Disruption",
    category: "Supply Chain", severity: "medium",
    assets: ["CL", "XLE", "MAERSK", "FDX"], direction: "bearish",
    probability: 0.78, probSource: "Polymarket", probDelta: +0.02, confidence: "medium",
    volume: 45600, cascadeEta: "1-4 weeks", momentum: "fading",
    summary: "Houthi drone attacks on commercial shipping have resumed after 3-week pause. Insurance premiums for Red Sea transit up 340%. Rerouting adds 10-14 days.",
    sector: "Energy", verified: true, sourceCount: 3,
    probHistory: [0.71, 0.74, 0.76, 0.79, 0.80, 0.79, 0.78],
  },
  {
    id: 5, title: "US-China Semiconductor Export Controls Expansion",
    category: "Regulatory", severity: "high",
    assets: ["NVDA", "AMD", "ASML", "LRCX"], direction: "bearish",
    probability: 0.54, probSource: "Kalshi", probDelta: +0.06, confidence: "high",
    volume: 223000, cascadeEta: "1-2 weeks", momentum: "escalating",
    summary: "Commerce Dept draft rule expands Entity List to include 14 additional Chinese AI labs. NVDA H200 exports to SE Asia under review for transshipment risk.",
    sector: "Technology", verified: true, sourceCount: 6,
    probHistory: [0.38, 0.41, 0.44, 0.47, 0.50, 0.52, 0.54],
  },
  {
    id: 6, title: "Category 5 Hurricane Approaching Gulf Coast",
    category: "Climate", severity: "medium",
    assets: ["CL", "NG", "XLE", "CORN"], direction: "bearish",
    probability: 0.89, probSource: "Kalshi", probDelta: +0.15, confidence: "high",
    volume: 187000, cascadeEta: "2-6 weeks", momentum: "escalating",
    summary: "Hurricane projected to make landfall near Houston within 72 hours. 40% of US refining capacity in projected path. Mandatory evacuations underway.",
    sector: "Commodities", verified: true, sourceCount: 8,
    probHistory: [0.45, 0.55, 0.67, 0.74, 0.81, 0.86, 0.89],
  },
  {
    id: 7, title: "Bitcoin ETF Institutional Rotation Signal",
    category: "Sentiment", severity: "low",
    assets: ["BTC", "IBIT", "GBTC"], direction: "bullish",
    probability: 0.33, probSource: "Polymarket", probDelta: -0.05, confidence: "low",
    volume: 8200, cascadeEta: "1-3 days", momentum: "fading",
    summary: "Whale wallets accumulating BTC aggressively over past 72h. On-chain data suggests institutional rotation from gold to BTC. Narrative building but unconfirmed.",
    sector: "Crypto", verified: false, sourceCount: 1,
    probHistory: [0.41, 0.39, 0.38, 0.36, 0.35, 0.34, 0.33],
  },
  {
    id: 8, title: "Russian Energy Infrastructure Sanctions Escalation",
    category: "Geopolitical", severity: "medium",
    assets: ["CL", "NG", "RSX", "XLE"], direction: "bearish",
    probability: 0.46, probSource: "Polymarket", probDelta: +0.04, confidence: "medium",
    volume: 67800, cascadeEta: "1-3 weeks", momentum: "escalating",
    summary: "G7 coalition finalizing secondary sanctions targeting Russian LNG export terminals. European gas storage at 62% — below seasonal average.",
    sector: "Energy", verified: true, sourceCount: 3,
    probHistory: [0.35, 0.37, 0.39, 0.41, 0.43, 0.44, 0.46],
  },
  {
    id: 9, title: "NVIDIA Antitrust Investigation Expansion",
    category: "Regulatory", severity: "medium",
    assets: ["NVDA", "AMD", "INTC"], direction: "bearish",
    probability: 0.38, probSource: "Kalshi", probDelta: +0.02, confidence: "medium",
    volume: 52300, cascadeEta: "2-8 weeks", momentum: "peaking",
    summary: "DOJ expanding scope of GPU market dominance investigation. Subpoenas issued to major cloud providers regarding exclusive supply agreements.",
    sector: "Technology", verified: true, sourceCount: 2,
    probHistory: [0.31, 0.33, 0.34, 0.36, 0.37, 0.38, 0.38],
  },
];

const SECTORS = [
  { name: "Technology", score: 74, threats: 3 },
  { name: "Energy", score: 58, threats: 2 },
  { name: "Finance", score: 61, threats: 1 },
  { name: "Crypto", score: 52, threats: 2 },
  { name: "Defense", score: 41, threats: 1 },
  { name: "Commodities", score: 47, threats: 1 },
];

const GPR_INDEX = 187; // Current Caldara-Iacoviello GPR value (elevated)
const GLOBAL_RISK = 68;

function getSeverityForScore(s) {
  if (s >= 70) return "critical";
  if (s >= 55) return "high";
  if (s >= 35) return "medium";
  return "low";
}

// ─── COMPONENTS ───

function TickerBar() {
  const [offset, setOffset] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setOffset(p => p - 0.5), 30);
    return () => clearInterval(id);
  }, []);
  const items = [...TICKERS, ...TICKERS, ...TICKERS];
  return (
    <div style={{
      background: "rgba(11,14,23,0.95)", borderBottom: `1px solid ${C.border}`,
      overflow: "hidden", height: 40, display: "flex", alignItems: "center",
      backdropFilter: "blur(12px)", position: "relative", zIndex: 10,
    }}>
      <div style={{
        display: "flex", gap: 32, whiteSpace: "nowrap",
        transform: `translateX(${offset}px)`, transition: "none",
      }}>
        {items.map((t, i) => (
          <div key={i} style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ color: C.textDim, fontSize: 11, fontWeight: 600, letterSpacing: 0.5 }}>{t.sym}</span>
            <span style={{ color: C.text, fontSize: 12, fontFamily: "'JetBrains Mono', monospace" }}>
              {t.sym === "BTC" || t.sym === "ETH" ? `$${t.price.toLocaleString()}` : `$${t.price.toFixed(2)}`}
            </span>
            <span style={{
              color: t.chg >= 0 ? C.bullish : C.bearish, fontSize: 11,
              fontFamily: "'JetBrains Mono', monospace",
            }}>
              {t.chg >= 0 ? "+" : ""}{t.chg.toFixed(2)}%
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

function MetricRow() {
  return (
    <div style={{
      display: "flex", gap: 12, padding: "12px 20px",
      background: C.bgPanel, borderBottom: `1px solid ${C.border}`,
    }}>
      <MetricCard label="ACTIVE THREATS" value={THREATS.length} sub="across 5 categories" />
      <MetricCard
        label="GLOBAL RISK INDEX"
        value={GLOBAL_RISK}
        sub="/100 — Elevated"
        color={GLOBAL_RISK >= 60 ? C.high : C.medium}
        showBar barValue={GLOBAL_RISK}
      />
      <MetricCard label="GPR INDEX" value={GPR_INDEX} sub="Caldara-Iacoviello (elevated)" color={C.accent} />
      <MetricCard label="ASSETS AT RISK" value="14" sub="NVDA · BTC · CL · SPY +10" />
    </div>
  );
}

function MetricCard({ label, value, sub, color, showBar, barValue }) {
  return (
    <div style={{
      flex: 1, background: C.bgCard, borderRadius: 8, padding: "12px 16px",
      border: `1px solid ${C.border}`,
    }}>
      <div style={{ fontSize: 9, color: C.textMuted, letterSpacing: 1.2, fontWeight: 600, marginBottom: 4 }}>{label}</div>
      <div style={{ fontSize: 26, fontWeight: 700, color: color || C.text, fontFamily: "'JetBrains Mono', monospace", lineHeight: 1 }}>{value}</div>
      {showBar && (
        <div style={{ height: 3, background: C.border, borderRadius: 2, marginTop: 6, overflow: "hidden" }}>
          <div style={{ height: "100%", width: `${barValue}%`, background: color || C.accent, borderRadius: 2 }} />
        </div>
      )}
      <div style={{ fontSize: 10, color: C.textMuted, marginTop: 4 }}>{sub}</div>
    </div>
  );
}

function ThreatCard({ threat, selected, onClick }) {
  const sev = severityMap[threat.severity];
  return (
    <div onClick={onClick} style={{
      background: selected ? sev.bg : C.bgCard,
      border: `1px solid ${selected ? sev.color + "44" : C.border}`,
      borderLeft: `3px solid ${sev.color}`,
      borderRadius: 8, padding: "12px 14px", cursor: "pointer",
      transition: "all 0.15s ease", marginBottom: 8,
    }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 6 }}>
        <div style={{ flex: 1 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4, flexWrap: "wrap" }}>
            <span style={{
              fontSize: 9, fontWeight: 700, color: sev.color, background: sev.color + "18",
              padding: "2px 6px", borderRadius: 3, letterSpacing: 0.8,
            }}>{sev.label}</span>
            <span style={{
              fontSize: 9, color: C.textMuted, background: C.border, padding: "2px 6px", borderRadius: 3,
            }}>{threat.category}</span>
            {!threat.verified && (
              <span style={{ fontSize: 9, color: C.high, background: C.high + "18", padding: "2px 6px", borderRadius: 3, fontWeight: 600 }}>UNVERIFIED</span>
            )}
            <span style={{
              fontSize: 9, color: threat.momentum === "escalating" ? C.critical : threat.momentum === "peaking" ? C.high : C.textMuted,
              fontWeight: 600,
            }}>▲ {threat.momentum}</span>
          </div>
          <div style={{ fontSize: 13, fontWeight: 600, color: C.text, lineHeight: 1.3 }}>{threat.title}</div>
        </div>
      </div>

      <div style={{ display: "flex", gap: 6, marginBottom: 8, flexWrap: "wrap" }}>
        {threat.assets.slice(0, 4).map(a => (
          <span key={a} style={{
            fontSize: 10, color: threat.direction === "bearish" ? C.bearish : threat.direction === "bullish" ? C.bullish : C.neutral,
            background: "rgba(255,255,255,0.04)", padding: "2px 6px", borderRadius: 3, fontFamily: "'JetBrains Mono', monospace",
          }}>
            {threat.direction === "bearish" ? "↓" : threat.direction === "bullish" ? "↑" : "→"} {a}
          </span>
        ))}
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <div style={{ flex: 1, height: 4, background: C.border, borderRadius: 2, overflow: "hidden" }}>
          <div style={{
            height: "100%", borderRadius: 2,
            width: `${threat.probability * 100}%`,
            background: `linear-gradient(90deg, ${threat.probSource === "Kalshi" ? C.kalshi : C.polymarket}, ${threat.probSource === "Kalshi" ? C.kalshi + "88" : C.polymarket + "88"})`,
          }} />
        </div>
        <span style={{ fontSize: 11, fontWeight: 700, color: C.text, fontFamily: "'JetBrains Mono', monospace", minWidth: 36, textAlign: "right" }}>
          {(threat.probability * 100).toFixed(0)}%
        </span>
        <span style={{
          fontSize: 8, padding: "1px 4px", borderRadius: 2, fontWeight: 600,
          color: threat.confidence === "high" ? C.bullish : threat.confidence === "medium" ? C.high : C.textMuted,
          background: threat.confidence === "high" ? C.bullish + "18" : threat.confidence === "medium" ? C.high + "18" : C.border,
        }}>
          {threat.confidence === "high" ? "HIGH CONF" : threat.confidence === "medium" ? "MED CONF" : "LOW CONF"}
        </span>
      </div>

      <div style={{ display: "flex", justifyContent: "space-between", marginTop: 6 }}>
        <span style={{ fontSize: 9, color: C.textMuted }}>
          {threat.probSource} · ${(threat.volume / 1000).toFixed(0)}k vol
        </span>
        <span style={{ fontSize: 9, color: threat.probDelta >= 0 ? C.bearish : C.bullish }}>
          {threat.probDelta >= 0 ? "+" : ""}{(threat.probDelta * 100).toFixed(0)}% 24h
        </span>
        <span style={{ fontSize: 9, color: C.textMuted }}>
          Cascade: {threat.cascadeEta}
        </span>
      </div>
    </div>
  );
}

function HeatmapGrid({ onSectorClick, activeSector }) {
  return (
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8 }}>
      {SECTORS.map(s => {
        const sev = getSeverityForScore(s.score);
        const col = severityMap[sev].color;
        const active = activeSector === s.name;
        return (
          <div key={s.name} onClick={() => onSectorClick(active ? null : s.name)} style={{
            background: active ? col + "12" : C.bgCard,
            border: `1px solid ${active ? col + "55" : C.border}`,
            borderRadius: 8, padding: "14px 12px", cursor: "pointer", textAlign: "center",
            transition: "all 0.15s ease",
          }}>
            <div style={{ fontSize: 10, color: C.textMuted, letterSpacing: 0.8, fontWeight: 600, marginBottom: 6 }}>{s.name.toUpperCase()}</div>
            <div style={{ fontSize: 28, fontWeight: 700, color: col, fontFamily: "'JetBrains Mono', monospace", lineHeight: 1 }}>{s.score}</div>
            <div style={{ fontSize: 9, color: C.textMuted, marginTop: 4 }}>{s.threats} active threat{s.threats !== 1 ? "s" : ""}</div>
          </div>
        );
      })}
    </div>
  );
}

function ProbabilityPanel() {
  const top5 = [...THREATS].sort((a, b) => b.probability - a.probability).slice(0, 5);
  return (
    <div>
      <div style={{ fontSize: 10, color: C.textMuted, letterSpacing: 1, fontWeight: 600, marginBottom: 10 }}>TOP PROBABILITIES</div>
      {top5.map(t => (
        <div key={t.id} style={{ marginBottom: 10 }}>
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 3 }}>
            <span style={{ fontSize: 11, color: C.text, fontWeight: 500 }}>{t.title.length > 32 ? t.title.slice(0, 32) + "…" : t.title}</span>
            <span style={{ fontSize: 11, fontWeight: 700, color: C.text, fontFamily: "'JetBrains Mono', monospace" }}>
              {(t.probability * 100).toFixed(0)}%
            </span>
          </div>
          <div style={{ height: 4, background: C.border, borderRadius: 2, overflow: "hidden" }}>
            <div style={{
              height: "100%", borderRadius: 2,
              width: `${t.probability * 100}%`,
              background: t.probSource === "Kalshi" ? C.kalshi : C.polymarket,
            }} />
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", marginTop: 2 }}>
            <span style={{ fontSize: 9, color: t.probSource === "Kalshi" ? C.kalshi : C.polymarket }}>{t.probSource}</span>
            <span style={{ fontSize: 9, color: t.probDelta >= 0 ? C.bearish : C.bullish }}>
              {t.probDelta >= 0 ? "+" : ""}{(t.probDelta * 100).toFixed(0)}% 24h
            </span>
          </div>
        </div>
      ))}
    </div>
  );
}

function MiniSparkline({ data, color, width = 80, height = 24 }) {
  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;
  const points = data.map((v, i) => {
    const x = (i / (data.length - 1)) * width;
    const y = height - ((v - min) / range) * (height - 4) - 2;
    return `${x},${y}`;
  }).join(" ");
  return (
    <svg width={width} height={height} style={{ display: "block" }}>
      <polyline points={points} fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function DetailPanel({ threat, onClose }) {
  if (!threat) return (
    <div style={{ padding: 20, textAlign: "center", color: C.textMuted, fontSize: 12, marginTop: 40 }}>
      Select a threat card to view details
    </div>
  );
  const sev = severityMap[threat.severity];
  return (
    <div style={{ padding: 16 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 12 }}>
        <div>
          <div style={{ display: "flex", gap: 6, marginBottom: 6 }}>
            <span style={{ fontSize: 9, fontWeight: 700, color: sev.color, background: sev.color + "18", padding: "2px 8px", borderRadius: 3 }}>{sev.label}</span>
            <span style={{ fontSize: 9, color: C.textMuted, background: C.border, padding: "2px 8px", borderRadius: 3 }}>{threat.category}</span>
            {!threat.verified && <span style={{ fontSize: 9, color: C.high, background: C.high + "18", padding: "2px 8px", borderRadius: 3, fontWeight: 600 }}>UNVERIFIED</span>}
          </div>
          <div style={{ fontSize: 16, fontWeight: 700, color: C.text }}>{threat.title}</div>
        </div>
        <button onClick={onClose} style={{ background: "none", border: "none", color: C.textMuted, cursor: "pointer", fontSize: 18, padding: 4 }}>×</button>
      </div>

      <div style={{ fontSize: 13, color: C.textDim, lineHeight: 1.6, marginBottom: 16, borderLeft: `2px solid ${sev.color}30`, paddingLeft: 12 }}>
        {threat.summary}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 16 }}>
        <div style={{ background: C.bgPanel, borderRadius: 6, padding: 10, border: `1px solid ${C.border}` }}>
          <div style={{ fontSize: 9, color: C.textMuted, letterSpacing: 0.8, marginBottom: 4 }}>PROBABILITY</div>
          <div style={{ display: "flex", alignItems: "baseline", gap: 6 }}>
            <span style={{ fontSize: 24, fontWeight: 700, color: C.text, fontFamily: "'JetBrains Mono', monospace" }}>{(threat.probability * 100).toFixed(0)}%</span>
            <span style={{ fontSize: 11, color: threat.probDelta >= 0 ? C.bearish : C.bullish }}>
              {threat.probDelta >= 0 ? "↑" : "↓"}{Math.abs(threat.probDelta * 100).toFixed(0)}% 24h
            </span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 4 }}>
            <span style={{ fontSize: 9, color: threat.probSource === "Kalshi" ? C.kalshi : C.polymarket, fontWeight: 600 }}>{threat.probSource}</span>
            <span style={{
              fontSize: 8, padding: "1px 4px", borderRadius: 2, fontWeight: 600,
              color: threat.confidence === "high" ? C.bullish : threat.confidence === "medium" ? C.high : C.textMuted,
              background: threat.confidence === "high" ? C.bullish + "18" : threat.confidence === "medium" ? C.high + "18" : C.border,
            }}>
              {threat.confidence.toUpperCase()} CONFIDENCE
            </span>
          </div>
          <div style={{ marginTop: 6 }}>
            <MiniSparkline data={threat.probHistory} color={threat.probSource === "Kalshi" ? C.kalshi : C.polymarket} width={140} height={28} />
            <div style={{ fontSize: 8, color: C.textMuted, marginTop: 2 }}>7-day probability trend</div>
          </div>
        </div>
        <div style={{ background: C.bgPanel, borderRadius: 6, padding: 10, border: `1px solid ${C.border}` }}>
          <div style={{ fontSize: 9, color: C.textMuted, letterSpacing: 0.8, marginBottom: 4 }}>CASCADE TIMELINE</div>
          <div style={{ fontSize: 18, fontWeight: 700, color: C.text }}>{threat.cascadeEta}</div>
          <div style={{ fontSize: 10, color: C.textMuted, marginTop: 2 }}>estimated market repricing window</div>
          <div style={{ marginTop: 8 }}>
            <div style={{ fontSize: 9, color: C.textMuted, marginBottom: 3 }}>Absorption progress</div>
            <div style={{ height: 4, background: C.border, borderRadius: 2, overflow: "hidden" }}>
              <div style={{ height: "100%", width: "35%", background: sev.color, borderRadius: 2 }} />
            </div>
            <div style={{ fontSize: 8, color: C.textMuted, marginTop: 2 }}>~35% priced in</div>
          </div>
        </div>
      </div>

      <div style={{ marginBottom: 16 }}>
        <div style={{ fontSize: 10, color: C.textMuted, letterSpacing: 0.8, fontWeight: 600, marginBottom: 8 }}>AFFECTED ASSETS</div>
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          {threat.assets.map(a => (
            <div key={a} style={{
              background: C.bgPanel, border: `1px solid ${C.border}`, borderRadius: 6,
              padding: "6px 10px", display: "flex", alignItems: "center", gap: 6,
            }}>
              <span style={{
                color: threat.direction === "bearish" ? C.bearish : C.bullish,
                fontSize: 12, fontWeight: 700,
              }}>
                {threat.direction === "bearish" ? "↓" : "↑"}
              </span>
              <span style={{ fontSize: 11, color: C.text, fontWeight: 600, fontFamily: "'JetBrains Mono', monospace" }}>{a}</span>
            </div>
          ))}
        </div>
      </div>

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div style={{ fontSize: 9, color: C.textMuted }}>
          {threat.sourceCount} independent source{threat.sourceCount > 1 ? "s" : ""} · {threat.momentum}
        </div>
        <button style={{
          background: C.accent + "22", color: C.accent, border: `1px solid ${C.accent}44`,
          borderRadius: 6, padding: "8px 16px", cursor: "pointer", fontSize: 11, fontWeight: 600,
          transition: "all 0.15s ease",
        }}>
          ⚡ Analyze with AI
        </button>
      </div>
    </div>
  );
}

function ForceBreakdown() {
  const forces = [
    { name: "Geopolitical", weight: 35, score: 72, color: C.critical },
    { name: "Macro", weight: 25, score: 61, color: C.high },
    { name: "Sentiment", weight: 20, score: 48, color: C.medium },
    { name: "Supply Chain", weight: 12, score: 55, color: C.high },
    { name: "Climate", weight: 8, score: 47, color: C.medium },
  ];
  return (
    <div>
      <div style={{ fontSize: 10, color: C.textMuted, letterSpacing: 1, fontWeight: 600, marginBottom: 10 }}>FORCE BREAKDOWN</div>
      {forces.map(f => (
        <div key={f.name} style={{ marginBottom: 8 }}>
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 2 }}>
            <span style={{ fontSize: 10, color: C.textDim }}>{f.name} <span style={{ color: C.textMuted }}>({f.weight}%)</span></span>
            <span style={{ fontSize: 10, color: f.color, fontWeight: 600, fontFamily: "'JetBrains Mono', monospace" }}>{f.score}</span>
          </div>
          <div style={{ height: 3, background: C.border, borderRadius: 2, overflow: "hidden" }}>
            <div style={{ height: "100%", width: `${f.score}%`, background: f.color, borderRadius: 2, opacity: 0.7 }} />
          </div>
        </div>
      ))}
    </div>
  );
}

// ─── MAIN APP ───
export default function VigilDashboard() {
  const [selectedThreat, setSelectedThreat] = useState(null);
  const [filter, setFilter] = useState("all");
  const [sectorFilter, setSectorFilter] = useState(null);
  const [now, setNow] = useState(new Date());

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  const filteredThreats = THREATS.filter(t => {
    if (sectorFilter && t.sector !== sectorFilter) return false;
    if (filter === "stocks") return t.assets.some(a => ["SPY", "QQQ", "NVDA", "TSLA", "AMD", "AAPL", "ASML", "LRCX", "INTC", "COIN", "MSTR", "TSM"].includes(a));
    if (filter === "crypto") return t.assets.some(a => ["BTC", "ETH", "COIN", "MSTR", "IBIT", "GBTC"].includes(a));
    if (filter === "commodities") return t.assets.some(a => ["CL", "NG", "GLD", "CORN"].includes(a));
    return true;
  });

  const severityOrder = { critical: 0, high: 1, medium: 2, low: 3 };
  const sorted = [...filteredThreats].sort((a, b) => severityOrder[a.severity] - severityOrder[b.severity]);

  return (
    <div style={{
      background: C.bg, color: C.text, minHeight: "100vh",
      fontFamily: "'DM Sans', 'Segoe UI', sans-serif",
    }}>
      <link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500;600;700&display=swap" rel="stylesheet" />

      <TickerBar />
      <MetricRow />

      {/* Filter Bar */}
      <div style={{
        display: "flex", justifyContent: "space-between", alignItems: "center",
        padding: "8px 20px", borderBottom: `1px solid ${C.border}`,
      }}>
        <div style={{ display: "flex", gap: 4 }}>
          {[
            { key: "all", label: "All" },
            { key: "stocks", label: "Stocks" },
            { key: "crypto", label: "Crypto" },
            { key: "commodities", label: "Commodities" },
          ].map(f => (
            <button key={f.key} onClick={() => { setFilter(f.key); setSectorFilter(null); }} style={{
              background: filter === f.key && !sectorFilter ? C.accent + "22" : "transparent",
              color: filter === f.key && !sectorFilter ? C.accent : C.textMuted,
              border: `1px solid ${filter === f.key && !sectorFilter ? C.accent + "44" : "transparent"}`,
              borderRadius: 5, padding: "4px 12px", cursor: "pointer", fontSize: 11, fontWeight: 500,
            }}>
              {f.label}
            </button>
          ))}
          {sectorFilter && (
            <button onClick={() => setSectorFilter(null)} style={{
              background: C.accent + "22", color: C.accent, border: `1px solid ${C.accent}44`,
              borderRadius: 5, padding: "4px 12px", cursor: "pointer", fontSize: 11, fontWeight: 500,
            }}>
              {sectorFilter} ×
            </button>
          )}
        </div>
        <div style={{ fontSize: 10, color: C.textMuted, fontFamily: "'JetBrains Mono', monospace" }}>
          LIVE · {now.toLocaleTimeString()} · {sorted.length} threats
        </div>
      </div>

      {/* Main Content */}
      <div style={{ display: "grid", gridTemplateColumns: "380px 1fr 280px", height: "calc(100vh - 160px)" }}>

        {/* Left: Threat Feed */}
        <div style={{
          borderRight: `1px solid ${C.border}`, padding: "12px 12px",
          overflowY: "auto", overflowX: "hidden",
        }}>
          <div style={{ fontSize: 10, color: C.textMuted, letterSpacing: 1, fontWeight: 600, marginBottom: 10, paddingLeft: 4 }}>
            LIVE THREAT FEED
          </div>
          {sorted.map(t => (
            <ThreatCard
              key={t.id} threat={t}
              selected={selectedThreat?.id === t.id}
              onClick={() => setSelectedThreat(t)}
            />
          ))}
        </div>

        {/* Center: Heatmap + Detail */}
        <div style={{ padding: "16px 20px", overflowY: "auto" }}>
          <div style={{ fontSize: 10, color: C.textMuted, letterSpacing: 1, fontWeight: 600, marginBottom: 10 }}>SECTOR RISK HEATMAP</div>
          <HeatmapGrid onSectorClick={(s) => { setSectorFilter(s); setFilter("all"); }} activeSector={sectorFilter} />

          <div style={{ marginTop: 20, borderTop: `1px solid ${C.border}`, paddingTop: 16 }}>
            <div style={{ fontSize: 10, color: C.textMuted, letterSpacing: 1, fontWeight: 600, marginBottom: 10 }}>THREAT DETAIL</div>
            <div style={{ background: C.bgCard, borderRadius: 8, border: `1px solid ${C.border}` }}>
              <DetailPanel threat={selectedThreat} onClose={() => setSelectedThreat(null)} />
            </div>
          </div>
        </div>

        {/* Right: Probabilities + Forces */}
        <div style={{
          borderLeft: `1px solid ${C.border}`, padding: "16px 14px",
          overflowY: "auto",
        }}>
          <ProbabilityPanel />
          <div style={{ borderTop: `1px solid ${C.border}`, marginTop: 16, paddingTop: 16 }}>
            <ForceBreakdown />
          </div>
          <div style={{ borderTop: `1px solid ${C.border}`, marginTop: 16, paddingTop: 16 }}>
            <div style={{ fontSize: 10, color: C.textMuted, letterSpacing: 1, fontWeight: 600, marginBottom: 8 }}>DATA SOURCES</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              {[
                { name: "Polymarket", status: "live", color: C.polymarket },
                { name: "Kalshi", status: "live", color: C.kalshi },
                { name: "GDELT", status: "live", color: C.bullish },
                { name: "Alpha Vantage", status: "live", color: C.bullish },
                { name: "CoinGecko", status: "live", color: C.bullish },
                { name: "GPR Index", status: "daily", color: C.high },
                { name: "Gemini Flash", status: "standby", color: C.textMuted },
              ].map(s => (
                <div key={s.name} style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <span style={{ fontSize: 10, color: C.textDim }}>{s.name}</span>
                  <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                    <div style={{ width: 5, height: 5, borderRadius: "50%", background: s.color }} />
                    <span style={{ fontSize: 9, color: s.color }}>{s.status}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
          <div style={{
            marginTop: 16, padding: "8px 10px", borderRadius: 6,
            background: "rgba(233,69,96,0.06)", border: `1px solid ${C.accent}22`,
          }}>
            <div style={{ fontSize: 9, color: C.accent, fontWeight: 600, marginBottom: 2 }}>DISCLAIMER</div>
            <div style={{ fontSize: 8, color: C.textMuted, lineHeight: 1.5 }}>
              Vigil displays geopolitical event severity data. It is not investment advice. Scores represent event conditions, not security recommendations. Not a registered investment adviser.
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
