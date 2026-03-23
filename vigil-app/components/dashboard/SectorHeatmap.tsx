"use client";

import styles from "../VigilDashboard.module.css";
import type { CSSWithCustomProperties } from "./shared";
import { scoreHex } from "./shared";

export default function SectorHeatmap({
  sectors,
  sectorFilter,
  onSelectSector,
}: {
  sectors: Array<{ name: string; score: number; count: number }>;
  sectorFilter: string | null;
  onSelectSector: (sector: string) => void;
}) {
  return (
    <>
      <div className={styles.sectionHeader}>Sector Risk Heatmap</div>
      <div className={styles.heatmapGrid}>
        {sectors.map((s) => {
          const isActive = sectorFilter === s.name;
          const hex = scoreHex(s.score);
          const style = isActive
            ? ({
                borderColor: `${hex}55`,
                background: `${hex}0d`,
                "--cell-glow": `${hex}18`,
              } as CSSWithCustomProperties)
            : ({ "--cell-glow": `${hex}0a` } as CSSWithCustomProperties);

          return (
            <div
              key={s.name}
              className={styles.heatmapCell}
              style={style}
              onClick={() => onSelectSector(s.name)}
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
  );
}

