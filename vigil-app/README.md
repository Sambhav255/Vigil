# Vigil

A geopolitical threat intelligence dashboard that aggregates prediction markets, global news volume, macro indicators, and natural-event feeds into a real-time risk scoring UI—built for a Bloomberg Terminal–style read on tail-risk.

![Next.js](https://img.shields.io/badge/Next.js-16-black) ![TypeScript](https://img.shields.io/badge/TypeScript-strict-blue) ![License](https://img.shields.io/badge/license-MIT-green)

---

## What it does

Vigil pulls live data when API keys are present, runs every threat through a multi-phase scorer, and renders a dark, information-dense dashboard:

| Area | Contents |
|------|----------|
| **Left — Feed** | Filterable threat list: severity, probability, composite score, sources, and deltas |
| **Center** | **Sector risk heatmap** (top) and **Threat detail** (below)—mechanism, assets, sparklines, cascade ETA, watch / analyze actions |
| **Right — Intel rail** | Top probabilities (click to focus a threat), force breakdown, data source health, signal hit rate, disclaimer |

On **mobile**, a bottom tab bar switches **Feed** / **Detail** / **Intel** so one pane fills the screen at a time (heatmap vs. detail vs. feed).

---

## Data sources

| Source | Role |
|--------|------|
| **Polymarket** & **Kalshi** | Prediction-market probabilities for geopolitical and macro-style events |
| **GDELT** | News volume by category—feeds confidence / corroboration signals |
| **FRED** | Macro series (CPI, unemployment, yields, etc.) |
| **USGS** | Significant earthquakes |
| **NASA EONET** | Wildfires, storms, floods, and other natural events |
| **Alpha Vantage** | Equity quotes (e.g. SPY, QQQ, NVDA) |
| **CoinGecko** / **Coinpaprika** | Crypto prices with fallback if a key is missing |

All sources are **optional**. Without keys, the app still runs using seed / mock data so layouts and scoring can be exercised locally.

---

## Scoring pipeline

1. **Phase 1 — Confidence** — Tier from market volume; **severity** is capped for single-source `critical` threats *after* deduplication, using the merged `sourceCount` so corroborated threats are scored fairly.

2. **Phase 2 — Bias correction** — Favorite–longshot adjustment on implied probabilities.

3. **Phase 3 — Decay** — Exponential decay with asymmetric half-lives (e.g. bearish vs bullish). Composite score blends sensitivity, GPR context, probability, and decay.

Near-duplicate titles are merged with Jaccard-style similarity before final scores are shown.

---

## Tech stack

- **Next.js 16** (App Router, React Server Components where applicable + client dashboard)
- **TypeScript** (strict) · **CSS Modules** + **Tailwind CSS 4**
- **Vitest** for unit tests
- **Convex** (optional) — auth, watchlists, alert history when `NEXT_PUBLIC_CONVEX_URL` is set
- **Groq** (optional) — LLM-backed threat **Analyze** via `POST /api/analyze` when `GROQ_API_KEY` is set

---

## Local setup

**Requirements:** Node.js **20.x** or **22.x** (see `engines` and `scripts/check-node.mjs`). **Node 25+** is not supported for this Next.js version.

```bash
cd vigil-app
cp .env.example .env.local   # optional — all keys can be empty for mock data
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

> **OneDrive / iCloud:** If installs or `next dev` time out or corrupt files, clone or copy `vigil-app/` to a non-synced path (e.g. `C:\dev\vigil-app`) and run commands there.

---

## Environment variables

Everything below is optional unless you want live data or AI analysis.

| Variable | Purpose | Free tier? |
|----------|---------|------------|
| `ALPHA_VANTAGE_API_KEY` | Live equity quotes | Yes |
| `COINGECKO_DEMO_API_KEY` | Crypto quotes — falls back to Coinpaprika | Yes |
| `FRED_API_KEY` | Macro indicators | Yes |
| `GROQ_API_KEY` | Enables **Analyze** on a threat (`/api/analyze`) — [Groq console](https://console.groq.com/keys) | Yes |
| `GROQ_MODEL` | Override chat model (default is set in `app/api/analyze/route.ts`) | — |
| `NEXT_PUBLIC_CONVEX_URL` | Convex deployment URL for auth / persistence | Yes (free tier) |
| `NEXT_PUBLIC_SITE_URL` | Canonical site URL for Open Graph metadata | — |

Copy from `.env.example` and never commit `.env.local`.

---

## Deploy to Vercel

1. Import the repo and set **Root Directory** to **`vigil-app`** (or rely on root `vercel.json` if present).
2. Set **Node.js** to **22.x** in Project → Settings.
3. Add env vars from `.env.example` as needed.
4. Deploy.

**Convex:** From `vigil-app/`, run `npx convex dev` once to link a project, then add `NEXT_PUBLIC_CONVEX_URL` in Vercel.

**CI:** `.github/workflows/ci.yml` runs lint, tests, and production build on pushes to `main`.

---

## Commands

```bash
npm run dev        # dev server → http://localhost:3000
npm run build      # production build
npm run lint       # ESLint
npm run test:run   # Vitest (CI / single run)
npm test           # Vitest watch mode
```

Single file:

```bash
npx vitest run tests/scoring.test.ts
```

---

## Keyboard shortcuts (desktop)

When focus is not in an input: **`j` / `k`** move selection, **`Enter`** selects first threat, **`Esc`** clears selection and search, **`/`** focuses search, **`p`** toggles portfolio view, **`1`–`4`** asset-class filters.

---

## Project structure

```
vigil-app/
├── app/
│   ├── api/
│   │   ├── dashboard/     # GET — aggregated snapshot for the UI
│   │   ├── analyze/       # POST — Groq-backed threat analysis
│   │   └── …
│   └── layout.tsx
├── components/
│   ├── VigilDashboard.tsx           # main shell + column layout
│   ├── VigilDashboard.module.css
│   └── dashboard/
│       ├── ThreatCard.tsx
│       ├── DetailPanel.tsx
│       ├── FilterBar.tsx
│       ├── SectorHeatmap.tsx
│       ├── RightPanel.tsx
│       └── …
├── lib/
│   ├── pipeline.ts        # scoring + dedupe orchestration
│   ├── data/              # source clients
│   ├── scoring/           # phases 1–3
│   └── types.ts
└── tests/                 # Vitest
```
