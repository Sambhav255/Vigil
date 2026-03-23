# CLAUDE.md

This file provides guidance to Claude Code when working with code in this repository.

<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

## Commands

All commands run from `vigil-app/`:

```bash
npm run dev        # Start dev server on http://localhost:3000
npm run build      # Production build
npm run lint       # ESLint (app, components, lib, tests, config — see package.json)
npm test           # Vitest (watch mode)
npm run test:run   # Vitest single run (CI)
```

Run a single test file:
```bash
npx vitest run tests/scoring.test.ts
```

## Architecture

Vigil is a geopolitical threat intelligence dashboard. It aggregates data from prediction markets, global news, macroeconomic indicators, and natural disaster feeds, applies a multi-phase scoring algorithm, and renders a Bloomberg Terminal-style dark UI.

### Edge / auth

- **`proxy.ts`** — Next.js 16 request proxy (auth via `@convex-dev/auth` when `NEXT_PUBLIC_CONVEX_URL` is set). API routes are excluded.

### Request Flow

```
Browser (components/VigilDashboard.tsx)
  → polls /api/dashboard every 15s
  → lib/pipeline.ts: buildDashboardSnapshot()
      → lib/data/sources.ts: fetch all APIs in parallel
          → Polymarket, Kalshi, GDELT (prediction markets + news)
          → lib/data/fred.ts: FRED macro indicators (FRED_API_KEY)
          → lib/data/usgs.ts: USGS significant earthquake feed (no auth)
          → lib/data/eonet.ts: NASA EONET natural events (no auth)
          → Alpha Vantage: stock quotes (ALPHA_VANTAGE_API_KEY)
          → CoinGecko + Coinpaprika fallback: crypto prices
      → lib/scoring/core.ts → phase2.ts → phase3.ts: multi-phase threat scoring
      → lib/degradation/sourceHealth.ts: classify each source as live/stale/delayed/offline
      → lib/logging/hitRate.ts: append high-score threats (>60) to data/hit-rate-log.json
  → returns {globalRisk, gprIndex, threats[], forces[], sourceHealth}
```

### Key Modules

- **`lib/pipeline.ts`** — Main orchestrator; only entry point to the scoring system
- **`lib/data/sources.ts`** — Fetches all external APIs; falls back gracefully on failure
- **`lib/data/fred.ts`** — FRED API client + macro stress score computation
- **`lib/data/usgs.ts`** — USGS earthquake feed → auto-generates earthquake threat cards
- **`lib/data/eonet.ts`** — NASA EONET natural event feed → auto-generates climate threat cards
- **`lib/scoring/core.ts`** — Phase 1: confidence classification, severity capping, composite score
- **`lib/scoring/phase2.ts`** — Phase 2: favorite-longshot bias correction, correlation windows
- **`lib/scoring/phase3.ts`** — Phase 3: decay functions, regime-switching correlation modes
- **`lib/config/constants.ts`** — Seed threat data, `CATEGORY_WEIGHTS`, `SOURCE_STALE_AFTER_MS`
- **`lib/types.ts`** — All shared TypeScript interfaces

### API Routes

| Route | Method | Notes |
|---|---|---|
| `/api/dashboard` | GET | Full snapshot; main polling endpoint |
| `/api/analyze` | POST | `{threatTitle}` → AI deep-dive; requires `GEMINI_API_KEY` |
| `/api/backtest` | POST | Hit-rate computation from supplied records |

### Environment Variables

All optional — app renders with mock/seed data if absent:

| Variable | Purpose |
|---|---|
| `ALPHA_VANTAGE_API_KEY` | Live stock quotes |
| `COINGECKO_DEMO_API_KEY` | Live crypto prices (Coinpaprika used as free fallback) |
| `FRED_API_KEY` | Live macro force scoring (CPI, unemployment, yields) |
| `GEMINI_API_KEY` | Enables `/api/analyze` AI deep-dive |

### Styling

CSS Modules + Tailwind CSS 4. Dark theme variables in `app/globals.css`. The UI design spec is in `vigil-cursor-prompt.md` — consult before making visual changes.

### Imports

TypeScript path alias `@/*` maps to `vigil-app/`. Use `@/lib/...`, `@/components/...`, etc.
