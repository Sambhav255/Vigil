"use client";

import styles from "./VigilDashboard.module.css";
import UserProfileButton from "../UserProfileButton";
import { fmtPrice } from "./shared";
import type { ViewMode } from "./dashboardTypes";

export type Ticker = { sym: string; price: number; chg: number };

export default function TickerBar({
  tickerSet,
}: {
  tickerSet: Ticker[];
  // kept for future extensions; currently unused but mirrors VigilDashboard API
  view?: ViewMode;
}) {
  return (
    <div className={styles.tickerBar}>
      <div className={styles.tickerBrand} aria-label="Vigil">
        VIGIL
      </div>
      <div className={styles.tickerScroll}>
        <div className={styles.tickerTrack}>
          {tickerSet.map((t, i) => (
            <span key={i} className={styles.tickerItem}>
              <span className={styles.tickerSym}>{t.sym}</span>
              <span className={styles.tickerPrice}>${fmtPrice(t.price)}</span>
              <span className={t.chg >= 0 ? styles.tickerChgPos : styles.tickerChgNeg}>
                {t.chg >= 0 ? "+" : ""}
                {t.chg.toFixed(2)}%
              </span>
            </span>
          ))}
        </div>
      </div>
      <div style={{ display: "flex", alignItems: "center", padding: "0 12px", flexShrink: 0 }}>
        <UserProfileButton />
      </div>
    </div>
  );
}

