Refactor the Vigil dashboard styling. Do NOT change any functionality, data, or component structure. Only change visual styling and polish. Here are the specific fixes:

## 1. Typography hierarchy (most important fix)
- Import "Inter" for body and "Geist Mono" (or "JetBrains Mono") for numbers. If using Tailwind, set in tailwind.config.
- All numbers (scores, percentages, prices, counts) must use the mono font at font-weight 600 or 700.
- Section headers like "LIVE THREAT FEED", "SECTOR RISK HEATMAP", "TOP PROBABILITIES" should be 10px, uppercase, tracking-[0.15em], text-zinc-500 font-medium — subtle, not loud.
- Threat card titles: text-sm font-semibold text-zinc-100 (14px, not big)
- De-emphasize sublabels: text-[11px] text-zinc-500

## 2. Severity color system — desaturate and use opacity
Current badges look like neon signs. Fix:
- CRITICAL: use bg-red-500/10 text-red-400 border border-red-500/20 (not solid bright red)
- HIGH: use bg-amber-500/10 text-amber-400 border border-amber-500/20
- MEDIUM: use bg-blue-500/10 text-blue-400 border border-blue-500/20
- LOW: use bg-emerald-500/10 text-emerald-400 border border-emerald-500/20
- All badges: text-[10px] font-semibold px-1.5 py-0.5 rounded-[3px]
- The 3px left border on threat cards should use these same muted colors at 60% opacity

## 3. Card surfaces — add subtle depth
- All cards (metric row, heatmap cells, threat cards, detail panel): bg-zinc-900/50 border border-zinc-800/60 rounded-lg
- On hover for interactive cards: bg-zinc-800/50 border-zinc-700/60 transition-all duration-150
- Selected threat card: bg-[severity-color]/5 border-l-[severity-color]/40 (very subtle tint, not obvious)
- Add a very subtle backdrop-blur-sm to the metric row cards to differentiate them from the background

## 4. Heatmap cells — make them feel alive
- Each cell should have a very faint radial gradient from the severity color at the center (at 3-5% opacity) fading to transparent. This makes the numbers feel like they're glowing without being garish.
- The score number should be the dominant element: text-3xl font-bold in the mono font
- Below it: "3 active threats" in text-[10px] text-zinc-600
- Sector name above: text-[10px] uppercase tracking-wide text-zinc-500
- Add hover:scale-[1.02] transition-transform duration-150 for subtle interactivity feel

## 5. Probability bars — thinner and more refined
- All probability bars: h-[3px] (not 4 or 5) with rounded-full
- Background track: bg-zinc-800
- Fill: use a subtle gradient — for Polymarket: from-indigo-500 to-indigo-400, for Kalshi: from-emerald-500 to-emerald-400
- The percentage number next to the bar: mono font, text-xs font-bold text-zinc-200

## 6. Ticker bar — higher contrast
- Background: bg-black/80 backdrop-blur-md border-b border-zinc-800/50
- Price text: text-zinc-200 (brighter than current)
- Positive %: text-emerald-400, Negative %: text-red-400
- Ticker symbol: text-zinc-500 font-medium text-[10px] uppercase tracking-wider
- Add a subtle horizontal separator (a dot · or thin pipe) between tickers for scannability

## 7. Detail panel refinement
- The summary text block: add a left border-l-2 border-zinc-700/50 pl-3 — subtle quote-block feel
- Probability and Cascade Timeline boxes: bg-zinc-900/80 border border-zinc-800 rounded-md p-4
- The sparkline should have a subtle glow effect: add a drop-shadow-[0_0_6px_rgba(99,102,241,0.3)] (color matched to source)
- "Analyze with AI" button: bg-gradient-to-r from-red-500/10 to-orange-500/10 border border-red-500/20 text-red-400 hover:border-red-500/40 hover:bg-red-500/15 transition-all — it should feel special but not scream

## 8. Data sources list — status dots need better visual
- Live dots: use a subtle animation — animate-pulse on a w-1.5 h-1.5 rounded-full bg-emerald-400
- Offline dots: bg-red-400 (no animation)
- Stale dots: bg-amber-400 (no animation)
- Source name: text-xs text-zinc-400
- Status label: text-[10px] same color as dot

## 9. Global background
- The page background should be bg-[#09090b] (zinc-950) not a lighter dark. The darker the background, the more the cards pop.
- Add a very subtle noise texture overlay if possible (CSS background-image with a tiny repeating SVG noise pattern at 2-3% opacity) — this is what separates "flat dark" from "premium dark"

## 10. Spacing consistency
- Gap between threat cards: gap-2 (8px, not more)
- Internal card padding: p-3 (12px) consistently
- Section header to content: mb-3
- Between the heatmap and detail panel: a thin border-t border-zinc-800/50 with pt-4 mt-4

Do NOT add any new features, components, or data. This is purely a styling pass. Every change should make the UI feel more like Bloomberg Terminal meets Linear app — dense, refined, and intentional.