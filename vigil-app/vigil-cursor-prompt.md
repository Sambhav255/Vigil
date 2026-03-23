# Vigil UI Rebuild — Cursor Prompt

Rebuild the Vigil dashboard UI from scratch. The current version looks like a basic card list with no information density, no visual hierarchy, and no feeling of a professional trading terminal. It needs to feel like Bloomberg meets a modern threat intelligence platform — dark, dense, data-rich, and alive.

## Design Direction

**Aesthetic**: Dark military-grade intelligence terminal meets modern fintech. Think: Bloomberg Terminal's information density + Palantir's dark UI + Linear's polish. NOT a generic SaaS dashboard.

**Color system**:
- Background: near-black with subtle blue undertone (#0A0E1A base, #111827 cards, #0F1629 panels)
- Severity: Critical = #EF4444 red, High = #F59E0B amber, Medium = #3B82F6 blue, Low = #22C55E green
- Accents: #E94560 (brand red), #5B5FEF (Polymarket purple), #10B981 (Kalshi green)
- Text: #E2E8F0 primary, #94A3B8 secondary, #64748B muted
- All severity colors should be used as left-border accents and subtle background tints on cards, never as large solid blocks

**Typography**:
- Use "DM Sans" for UI text (import from Google Fonts)
- Use "JetBrains Mono" for all numbers, percentages, scores, prices, timestamps (import from Google Fonts)
- Avoid Inter, Roboto, Arial completely
- Section headers: 9-10px uppercase with letter-spacing: 1.2px, muted color, weight 600

**Key principle**: Every pixel should communicate data. No empty space that doesn't serve a purpose. A trader glancing at this for 3 seconds should know: what's the biggest threat right now, how confident are we, and what assets are at risk.

## Layout — Three Column Grid

The page has NO scroll on the main body. It's a fixed viewport dashboard. Individual panels scroll internally.

```
┌──────────────────────────────────────────────────────────┐
│ TICKER BAR (auto-scrolling prices, full width)           │
├──────────────────────────────────────────────────────────┤
│ METRIC ROW (4 metric cards: threats, risk index, GPR, assets at risk) │
├──────────────────────────────────────────────────────────┤
│ FILTER BAR (All | Stocks | Crypto | Commodities + live clock + count) │
├─────────────┬────────────────────────┬──────────────────┤
│ LEFT        │ CENTER                 │ RIGHT            │
│ Threat Feed │ Heatmap + Detail Panel │ Probabilities +  │
│ (scrollable)│ (scrollable)           │ Forces + Sources │
│ ~380px      │ flex                   │ ~280px           │
│             │                        │                  │
│             │                        │                  │
└─────────────┴────────────────────────┴──────────────────┘
```

Height of main 3-column area: `calc(100vh - height of ticker + metrics + filter)`. Each column has `overflow-y: auto` with hidden scrollbars.

## Component Specifications

### 1. Ticker Bar (top, full width)
- Auto-scrolling left, smooth CSS animation (not jumpy interval-based)
- Each ticker shows: symbol (dim, 11px, weight 600) → price (white, 12px, mono) → % change (green if positive, red if negative, 11px, mono)
- Separated by subtle dots or spacing (32px gap)
- Background: slightly darker than page with bottom border
- Duplicate the ticker array 3x for seamless loop illusion
- Fixed height: 40px

### 2. Metric Row
Four equal-width cards in a row:
- **Active Threats**: count in large mono font (26px, weight 700), sublabel "across N categories"
- **Global Risk Index**: large number + /100 sublabel + a thin 3px horizontal bar showing the fill percentage. Color the number by severity threshold (>70 = red, >55 = amber, >35 = blue, else green)
- **GPR Index**: current Caldara-Iacoviello value, sublabel "(elevated)" or "(normal)" based on threshold
- **Assets at Risk**: count + top 4 ticker names in sublabel

Each card: dark card background, 1px border, 8px border-radius, 12-16px padding. Section label is 9px uppercase muted.

### 3. Filter Bar
- Pill-style toggle buttons: All | Stocks | Crypto | Commodities
- Active state: brand accent background at 15% opacity + accent text + 1px accent border
- If a sector filter is active from clicking the heatmap, show it as a removable chip with "×"
- Right side: "LIVE" dot + current time in mono + threat count

### 4. Threat Feed (Left Column)
Section header: "LIVE THREAT FEED" in 10px uppercase muted

Each threat card:
- **Left border**: 3px solid, colored by severity
- **Top row**: severity badge (tiny pill, 9px, colored background at 15% opacity + colored text) + category badge (9px, gray background) + momentum label ("▲ escalating" in red, "● peaking" in amber, "▼ fading" in muted) + if unverified: "UNVERIFIED" badge in amber
- **Title**: 13px, weight 600, white
- **Asset chips row**: each affected ticker as a small chip with directional arrow (↓ red for bearish, ↑ green for bullish), mono font
- **Probability bar**: thin 4px bar with gradient fill (purple for Polymarket, green for Kalshi) + percentage in mono on the right + confidence tier badge ("HIGH CONF" in green, "MED CONF" in amber, "LOW CONF" in gray)
- **Bottom row**: source + volume ("Polymarket · $84k vol") | 24h delta ("+8% 24h" in red if probability increased = worse) | cascade ETA
- Card background: slightly lighter on hover or when selected. Selected state: severity-tinted background + severity-colored border

Cards are 8px border-radius, 12-14px padding, 8px margin-bottom.

### 5. Sector Risk Heatmap (Center, Top)
- 3×2 grid of sector cells: Technology, Energy, Finance, Crypto, Defense, Commodities
- Each cell: sector name in 10px uppercase muted, score in 28px mono font colored by severity, "N active threats" sublabel
- Clicking a cell filters the threat feed to that sector (toggle behavior — click again to deselect)
- Active cell: severity-colored border + tinted background
- Cards: 8px border-radius, 14px padding, cursor pointer

### 6. Detail Panel (Center, Bottom)
Section header: "THREAT DETAIL"

When no threat selected: centered muted text "Select a threat card to view details"

When a threat is selected, show inside a card with border:
- **Header**: severity + category badges, title in 16px bold, close "×" button
- **Summary**: the 1-2 sentence description, styled with a left border accent (2px, severity color at 30% opacity), indented padding-left 12px, in slightly dimmer text
- **Two-column grid** below summary:
  - Left box: "PROBABILITY" — large % number + 24h delta arrow + source name + confidence badge + a 7-day sparkline (SVG polyline, 140×28px, colored by source)
  - Right box: "CASCADE TIMELINE" — ETA in large text + "estimated market repricing window" sublabel + a thin progress bar showing "~35% priced in"
- **Affected Assets**: row of asset chips (same style as threat card but slightly larger, with directional arrows)
- **Bottom**: source count + momentum label on left, "⚡ Analyze with AI" button on right (accent color, outlined style, hover glow)

### 7. Right Panel — Probability Rankings
Section header: "TOP PROBABILITIES"

Top 5 threats by probability. Each:
- Title (truncated to ~32 chars with ellipsis) + percentage (mono, right-aligned)
- Thin probability bar (4px, colored by source)
- Source name (colored) + 24h delta below

### 8. Right Panel — Force Breakdown
Below probability rankings, separated by a 1px border.

Section header: "FORCE BREAKDOWN"

List of 5 forces (Geopolitical, Macro, Sentiment, Supply Chain, Climate) each showing:
- Name + weight in parentheses (dim) + score on right (mono, colored by severity)
- 3px progress bar below

### 9. Right Panel — Data Source Status
Below force breakdown, separated by a 1px border.

Section header: "DATA SOURCES"

List of 7 sources (Polymarket, Kalshi, GDELT, Alpha Vantage, CoinGecko, GPR Index, Gemini Flash) each showing:
- Name on left
- Status dot (5px circle) + status label ("live" in green, "daily" in amber for GPR, "standby" in gray for Gemini, "offline" in red if degraded)

### 10. SEC Disclaimer
At the very bottom of the right panel:
- Tiny card with subtle accent border
- "DISCLAIMER" header in 9px accent color
- Body in 8px muted: "Vigil displays geopolitical event severity data. It is not investment advice. Scores represent event conditions, not security recommendations."

## Interaction Details

- Clicking a threat card selects it and populates the detail panel. Clicking again or the "×" deselects.
- Clicking a heatmap sector cell filters the threat feed. Clicking again removes filter.
- Filter bar buttons (All/Stocks/Crypto/Commodities) work as toggle group. Sector filter from heatmap shows as a removable chip.
- "Analyze with AI" button is visual only (no API call needed in prototype)
- Ticker bar scrolls continuously via CSS animation or smooth requestAnimationFrame

## Data

Use this simulated data for the prototype. In production these come from Polymarket/Kalshi/GDELT/Alpha Vantage/CoinGecko/GPR Index APIs.

### Tickers
SPY $568.42 (-0.73%), QQQ $487.15 (-1.12%), BTC $87,241 (+2.34%), ETH $3,412 (+1.87%), GLD $243.67 (+0.95%), CL $71.23 (-1.54%), TSLA $178.90 (-2.41%), NVDA $124.56 (-1.89%)

### Threats (9 total)

1. **Taiwan Strait Military Escalation** — Geopolitical, CRITICAL, assets: NVDA/TSM/AAPL/QQQ, bearish, prob 23% Polymarket (medium conf, $84k vol, +8% 24h), cascade 2-5 days, escalating, verified (4 sources), sector: Technology, prob history: [12,14,15,18,19,21,23]

2. **Federal Reserve Emergency Rate Decision** — Macroeconomic, HIGH, assets: SPY/QQQ/TLT/DXY, bearish, prob 41% Kalshi (high conf, $312k vol, +12% 24h), cascade 3-7 days, escalating, verified (7 sources), sector: Finance, prob history: [22,25,29,31,35,38,41]

3. **EU Comprehensive Crypto Regulation** — Regulatory, HIGH, assets: BTC/ETH/COIN/MSTR, bearish, prob 67% Polymarket (high conf, $156k vol, -3% 24h), cascade 1-3 weeks, peaking, verified (5 sources), sector: Crypto, prob history: [58,62,65,68,70,69,67]

4. **Gulf of Aden Shipping Route Disruption** — Supply Chain, MEDIUM, assets: CL/XLE/MAERSK/FDX, bearish, prob 78% Polymarket (medium conf, $45k vol, +2% 24h), cascade 1-4 weeks, fading, verified (3 sources), sector: Energy, prob history: [71,74,76,79,80,79,78]

5. **US-China Semiconductor Export Controls Expansion** — Regulatory, HIGH, assets: NVDA/AMD/ASML/LRCX, bearish, prob 54% Kalshi (high conf, $223k vol, +6% 24h), cascade 1-2 weeks, escalating, verified (6 sources), sector: Technology, prob history: [38,41,44,47,50,52,54]

6. **Category 5 Hurricane Approaching Gulf Coast** — Climate, MEDIUM, assets: CL/NG/XLE/CORN, bearish, prob 89% Kalshi (high conf, $187k vol, +15% 24h), cascade 2-6 weeks, escalating, verified (8 sources), sector: Commodities, prob history: [45,55,67,74,81,86,89]

7. **Bitcoin ETF Institutional Rotation Signal** — Sentiment, LOW, assets: BTC/IBIT/GBTC, bullish, prob 33% Polymarket (low conf, $8.2k vol, -5% 24h), cascade 1-3 days, fading, UNVERIFIED (1 source), sector: Crypto, prob history: [41,39,38,36,35,34,33]

8. **Russian Energy Infrastructure Sanctions Escalation** — Geopolitical, MEDIUM, assets: CL/NG/RSX/XLE, bearish, prob 46% Polymarket (medium conf, $67k vol, +4% 24h), cascade 1-3 weeks, escalating, verified (3 sources), sector: Energy, prob history: [35,37,39,41,43,44,46]

9. **NVIDIA Antitrust Investigation Expansion** — Regulatory, MEDIUM, assets: NVDA/AMD/INTC, bearish, prob 38% Kalshi (medium conf, $52k vol, +2% 24h), cascade 2-8 weeks, peaking, verified (2 sources), sector: Technology, prob history: [31,33,34,36,37,38,38]

### Sectors
Technology: score 74 (3 threats), Energy: score 58 (2 threats), Finance: score 61 (1 threat), Crypto: score 52 (2 threats), Defense: score 41 (1 threat), Commodities: score 47 (1 threat)

### Metrics
Global Risk Index: 68, GPR Index: 187, Active threats: 9, Assets at risk: 14

### Force Breakdown
Geopolitical: 72/100 (35% weight), Macro: 61/100 (25% weight), Sentiment: 48/100 (20% weight), Supply Chain: 55/100 (12% weight), Climate: 47/100 (8% weight)

## What NOT to do

- Do NOT use Inter, Roboto, or system fonts
- Do NOT use large padding or spacing that wastes screen real estate
- Do NOT make it scrollable as a full page — it's a fixed viewport dashboard with internal panel scrolling
- Do NOT use solid-color severity backgrounds — use tinted/opacity versions
- Do NOT make cards look like generic Material UI components
- Do NOT add shadows or rounded corners larger than 8px
- Do NOT show empty white/gray space — every area should feel populated
- Do NOT make the threat feed cards too tall — they should be compact so you can see 5-6 at once without scrolling
- Do NOT forget the 3px left-border severity accent on threat cards — this is the primary visual hierarchy signal

## Tech Stack
- Next.js with React
- Tailwind CSS (use it fully — no inline styles unless necessary)
- Recharts for any charts (probability sparklines can be raw SVG instead)
- Google Fonts: DM Sans + JetBrains Mono
- No additional UI libraries (no shadcn, no MUI, no Ant Design)
