# Vigil

A geopolitical threat intelligence dashboard that aggregates prediction markets, global news, macroeconomic indicators, and natural disaster feeds into a real-time risk scoring system. Built for analysts who want a Bloomberg Terminal-style view of global tail-risk events.

![Next.js](https://img.shields.io/badge/Next.js-16-black) ![TypeScript](https://img.shields.io/badge/TypeScript-strict-blue) ![License](https://img.shields.io/badge/license-MIT-green)

---

## What it does

Vigil pulls live data from multiple sources, scores every threat through a three-phase algorithm, and renders a dark-theme dashboard with three panels:

- **Feed** — filterable, sortable threat list with severity, probability, and composite score
- **Detail** — per-threat deep-dive: probability sparkline, affected assets, cascade ETA, AI analysis
- **Intel** — sector heatmap, macro force indicators, source health, and probability rankings

On mobile, a fixed bottom tab bar (Feed / Detail / Intel) replaces the three-column layout.

---

## Data sources

| Source | What it provides |
|---|---|
| Polymarket + Kalshi | Prediction market probabilities for geopolitical events |
| GDELT | Global news event database — corroborates and deduplicates threats |
| FRED | Macro indicators: CPI, unemployment, yield curve spread |
| USGS | Real-time significant earthquake feed |
| NASA EONET | Natural event feed: wildfires, cyclones, floods |
| Alpha Vantage | Live equity quotes (SPY, QQQ, TSLA, NVDA, …) |
| CoinGecko / Coinpaprika | Live crypto prices (BTC, ETH) with fallback |

All sources are optional. The app renders with seed/mock data when API keys are absent.

---

## Scoring pipeline

Threats go through three phases before display:

1. **Phase 1 — Confidence classification** Assigns `low / medium / high` confidence based on prediction market volume. Caps severity to `high` for single-source threats (applied after deduplication so merged threats are evaluated at their final source count).

2. **Phase 2 — Bias correction** Applies favorite-longshot correction: low-probability events are boosted, high-probability events are discounted.

3. **Phase 3 — Temporal decay** Exponential decay with regime-switching half-lives: bearish events decay at 21 h, bullish at 14 h. Composite score = `probability × severity_weight × confidence_factor × decay`.

Jaccard-similarity deduplication merges near-duplicate threats before scoring finalizes.

---

## Tech stack

- **Next.js 16** (App Router, `"use client"` components)
- **React 18** with strict TypeScript
- **CSS Modules** + Tailwind CSS 4 — dark theme, Bloomberg Terminal aesthetic
- **Vitest** for unit tests
- **Convex** (optional) — auth, persistent watchlists, alert log
- **Gemini API** (optional) — AI threat deep-dive via `/api/analyze`

---

## Local setup

**Requirements:** Node.js 20.x or 22.x. Node 25+ breaks the Next.js server bundle.

```bash
# If using nvm (reads .nvmrc automatically):
nvm install && nvm use

# Install and run
cp .env.example .env.local   # all keys are optional
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

> **OneDrive / iCloud users:** If installs or `next dev` hit timeouts, copy `vigil-app/` to a local path (e.g. `/tmp/vigil-app`) and run commands there.

---

## Environment variables

All variables are optional. The app renders with mock data when keys are absent.

| Variable | Purpose | Free tier? |
|---|---|---|
| `ALPHA_VANTAGE_API_KEY` | Live equity quotes | Yes |
| `COINGECKO_DEMO_API_KEY` | Live crypto prices — falls back to Coinpaprika | Yes |
| `FRED_API_KEY` | Live macro indicators (CPI, unemployment, yields) | Yes |
| `GEMINI_API_KEY` | Enables AI threat analysis | Yes (Gemini Flash) |
| `NEXT_PUBLIC_CONVEX_URL` | Enables auth + persistent watchlists | Yes (free tier) |
| `NEXT_PUBLIC_SITE_URL` | Base URL for OG metadata | — |

---

## Deploy to Vercel

1. Import the repo. Set **Root Directory** to `vigil-app` in the Vercel project settings.
2. Set **Node.js version** to **22.x**.
3. Add any environment variables from `.env.example`.
4. Deploy.

For Convex auth: run `npx convex dev` locally first to provision the backend, then copy `NEXT_PUBLIC_CONVEX_URL` into Vercel's environment variables.

**CI:** `.github/workflows/ci.yml` runs lint, tests, and a production build on every push to `main`.

---

## Commands

```bash
npm run dev        # dev server → http://localhost:3000
npm run build      # production build
npm run lint       # ESLint
npm run test:run   # Vitest (single run / CI)
npm test           # Vitest (watch mode)
```

Run a single test file:
```bash
npx vitest run tests/scoring.test.ts
```

---

## Project structure

```
vigil-app/
├── app/
│   ├── api/
│   │   ├── dashboard/     # main polling endpoint (GET)
│   │   ├── analyze/       # Gemini AI deep-dive (POST)
│   │   └── …
│   └── layout.tsx
├── components/
│   ├── VigilDashboard.tsx          # root client component
│   ├── VigilDashboard.module.css   # all dashboard styles
│   └── dashboard/
│       ├── ThreatCard.tsx
│       ├── DetailPanel.tsx
│       ├── FilterBar.tsx
│       ├── SectorHeatmap.tsx
│       ├── RightPanel.tsx
│       └── …
├── lib/
│   ├── pipeline.ts        # main orchestrator
│   ├── data/              # API clients (FRED, USGS, EONET, sources)
│   ├── scoring/           # phase1, phase2, phase3 algorithms
│   └── types.ts
└── tests/                 # Vitest unit tests
```
