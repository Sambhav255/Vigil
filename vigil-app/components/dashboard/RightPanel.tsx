"use client";

import { useEffect, useState } from "react";
import styles from "../VigilDashboard.module.css";
import type { Snapshot, Threat } from "./dashboardTypes";
import { SOURCE_DISPLAY, scoreHex, truncateTitle } from "./shared";

function probDeltaClass(delta: number) {
  if (delta > 0) return styles.probDeltaPos;
  if (delta < 0) return styles.probDeltaNeg;
  return styles.probDeltaNeutral;
}

function getSourceDisplay(name: string, state: string) {
  if (name === "gprIndex") return { dot: "#b07028", label: "daily" };
  if (name === "geminiFlash") return { dot: "#4a4845", label: "standby" };
  if (state === "live") return { dot: "#25784a", label: "live" };
  if (state === "stale") return { dot: "#b07028", label: "stale" };
  if (state === "delayed") return { dot: "#b07028", label: "delayed" };
  return { dot: "#c42626", label: "offline" };
}

export default function RightPanel({ data }: { data: Snapshot }) {
  const [hitRate, setHitRate] = useState<{ hitRate: number; sampleSize: number } | null>(null);

  useEffect(() => {
    let alive = true;
    void (async () => {
      try {
        const res = await fetch("/api/hit-rate", { cache: "no-store" });
        if (!res.ok) return;
        const json = (await res.json()) as { hitRate: number; sampleSize: number };
        if (alive) setHitRate(json);
      } catch {
        // ignore failures; panel gracefully degrades
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  return (
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
                <span className={styles.probRankPct}>{(t.probability * 100).toFixed(0)}%</span>
              </div>
              <div className={styles.probRankBar}>
                <div
                  className={`${styles.probRankBarFill} ${
                    t.probSource === "Polymarket" ? styles.probBarPolymarket : styles.probBarKalshi
                  }`}
                  style={{ width: `${(t.probability * 100).toFixed(0)}%` }}
                />
              </div>
              <div className={styles.probRankMeta}>
                <span className={t.probSource === "Polymarket" ? styles.srcPolymarket : styles.srcKalshi}>
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
                {f.name} <span className={styles.forceWeight}>({Math.round(f.weight * 100)}%)</span>
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

      <div className={styles.rightSection}>
        <div className={styles.sectionHeader}>Signal Hit Rate</div>
        <div className={styles.forceItem}>
          {hitRate && hitRate.sampleSize === 0 ? (
            <div className={styles.detailBoxSub}>
              Insufficient data · signals accumulate after first run
            </div>
          ) : (
            <>
              <div className={styles.forceHeader}>
                <span className={styles.forceName}>Estimated 30d quality</span>
                <span className={styles.forceScore}>
                  {hitRate ? (
                    <>
                      {hitRate.hitRate}%
                      {hitRate.sampleSize > 0 && hitRate.sampleSize < 10 && (
                        <span style={{ fontSize: 9, color: 'var(--text-muted)', marginLeft: 4 }}>
                          (limited sample)
                        </span>
                      )}
                    </>
                  ) : '—'}
                </span>
              </div>
              <div className={styles.forceBar}>
                <div
                  className={styles.forceBarFill}
                  style={{
                    width: `${Math.max(0, Math.min(100, hitRate?.hitRate ?? 0))}%`,
                    background: scoreHex(hitRate?.hitRate ?? 0),
                  }}
                />
              </div>
              <div className={styles.detailBoxSub}>
                {hitRate ? `${hitRate.sampleSize} alerts sampled` : 'No local hit-rate log available'}
              </div>
            </>
          )}
        </div>
      </div>

      <div className={styles.disclaimer}>
        <div className={styles.disclaimerHeader}>Disclaimer</div>
        <div className={styles.disclaimerText}>
          Vigil displays geopolitical event severity data. It is not investment advice.
          Scores represent event conditions, not security recommendations.
        </div>
      </div>
    </div>
  );
}

