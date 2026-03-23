"use client";

import type { RefObject } from "react";
import styles from "../VigilDashboard.module.css";
import { scoreHex } from "./shared";
import type { AssetMeta, Threat } from "./dashboardTypes";
import { STATIC_ASSET_SECTORS } from "@/lib/asset/staticAssetSectors";

type AssetRisk = {
  score: number;
  direction: "bearish" | "bullish" | "neutral";
  count: number;
  relatedCount: number;
  topThreat: string | null;
  hasRelated: boolean;
};

export default function PortfolioView({
  portfolio,
  portfolioSearch,
  setPortfolioSearch,
  showDrop,
  setShowDrop,
  dropRef,
  searchSuggestions,
  assetMetaBySym,
  getRiskForSym,
  addToPortfolio,
  removeFromPortfolio,
  reorderPortfolio,
}: {
  portfolio: string[];
  portfolioSearch: string;
  setPortfolioSearch: (value: string) => void;
  showDrop: boolean;
  setShowDrop: (value: boolean) => void;
  dropRef: RefObject<HTMLDivElement>;
  searchSuggestions: string[];
  assetMetaBySym: Record<string, AssetMeta>;
  getRiskForSym: (sym: string) => AssetRisk;
  addToPortfolio: (sym: string) => void;
  removeFromPortfolio: (sym: string) => void;
  reorderPortfolio: (fromIdx: number, toIdx: number) => void;
}) {
  const portfolioRows = portfolio.map((sym, index) => {
    const meta = assetMetaBySym[sym];
    const assetName = meta?.name ?? null;
    const risk = getRiskForSym(sym);
    const borderColor = risk.score > 0 ? scoreHex(risk.score) : "rgba(255,255,255,0.07)";
    return { sym, index, meta, assetName, risk, borderColor };
  });

  const portfolioRiskScore =
    portfolioRows.length > 0
      ? Math.round(portfolioRows.reduce((acc, r) => acc + r.risk.score, 0) / portfolioRows.length)
      : 0;
  const totalRisk = Math.max(1, portfolioRows.reduce((acc, r) => acc + Math.max(0, r.risk.score), 0));
  const mostConcentrated = portfolioRows
    .map((r) => ({ sym: r.sym, share: Math.round((Math.max(0, r.risk.score) / totalRisk) * 100) }))
    .sort((a, b) => b.share - a.share)[0];
  const concentrationWarning = !!mostConcentrated && mostConcentrated.share >= 60;

  const copySummary = async () => {
    const lines = [
      `Portfolio Risk Score: ${portfolioRiskScore}/100`,
      concentrationWarning
        ? `Concentration Warning: ${mostConcentrated.sym} contributes ${mostConcentrated.share}% of portfolio risk`
        : "Concentration: diversified",
      ...portfolioRows.map((r) => `${r.sym}: ${Math.round(r.risk.score)}/100 (${r.risk.direction})`),
    ];
    try {
      await navigator.clipboard.writeText(lines.join("\n"));
    } catch {
      // ignore clipboard write failures
    }
  };

  return (
    <>
      <div className={styles.sectionHeader}>Portfolio Monitor</div>

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
          <button type="button" className={styles.portfolioAddBtn} onClick={() => addToPortfolio(portfolioSearch)}>
            + Add
          </button>
        )}

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
                  setShowDrop(false);
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
                        const risk = getRiskForSym(sym);
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

      {portfolio.length === 0 ? (
        <div className={styles.portfolioEmpty}>
          <div className={styles.portfolioEmptyIcon}>◎</div>
          <div>Add tickers above to monitor their geopolitical risk exposure.</div>
          <div style={{ marginTop: 6, fontSize: 10 }}>Threats from the feed automatically map to your positions.</div>
        </div>
      ) : (
        <>
          <div className={styles.portfolioSummaryRow}>
            <div className={styles.portfolioSummaryCard}>
              <span className={styles.portfolioSummaryLabel}>Portfolio Risk Score</span>
              <span className={styles.portfolioSummaryValue}>{portfolioRiskScore}/100</span>
            </div>
            <div className={styles.portfolioSummaryCard}>
              <span className={styles.portfolioSummaryLabel}>Concentration</span>
              <span className={concentrationWarning ? styles.portfolioConcentrationWarn : styles.portfolioConcentrationOk}>
                {mostConcentrated ? `${mostConcentrated.sym} ${mostConcentrated.share}%` : "—"}
              </span>
            </div>
            <button type="button" className={styles.portfolioCopyBtn} onClick={copySummary}>
              Copy Summary
            </button>
          </div>
          <div className={styles.portfolioGrid}>
          {portfolioRows.map(({ sym, index, assetName, risk, borderColor }) => {
            return (
              <div
                key={sym}
                className={styles.portfolioCard}
                style={{ borderLeftColor: borderColor }}
                draggable
                onDragStart={(e) => {
                  e.dataTransfer.setData("text/plain", String(index));
                  e.dataTransfer.effectAllowed = "move";
                }}
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => {
                  e.preventDefault();
                  const fromIdx = Number(e.dataTransfer.getData("text/plain"));
                  if (Number.isFinite(fromIdx)) reorderPortfolio(fromIdx, index);
                }}
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

                <div className={styles.portfolioCardScore} style={{ color: risk.score > 0 ? scoreHex(risk.score) : "var(--text-muted)" }}>
                  {risk.score > 0 ? Math.round(risk.score) : "—"}
                  <span className={styles.portfolioCardScoreUnit}>/100</span>
                </div>

                <div className={styles.portfolioCardMeta}>
                  <span
                    className={
                      risk.direction === "bearish" ? styles.dirBearish : risk.direction === "bullish" ? styles.dirBullish : styles.dirNeutral
                    }
                  >
                    {risk.direction === "bearish" ? "↓ bearish" : risk.direction === "bullish" ? "↑ bullish" : "→ neutral"}
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
                    {risk.topThreat.length > 40 ? `${risk.topThreat.slice(0, 40)}…` : risk.topThreat}
                  </div>
                )}
              </div>
            );
          })}
        </div>
        </>
      )}
    </>
  );
}

