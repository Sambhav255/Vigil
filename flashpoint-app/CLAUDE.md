# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

## Commands

All commands run from the Vigil Next.js app directory (`flashpoint-app/`):

```bash
npm run dev        # Start dev server on http://localhost:3000
npm run build      # Production build
npm run lint       # Run ESLint
npm test           # Vitest in watch mode
npm run test:run   # Vitest single run (CI)
```

Run a single test file:
```bash
npx vitest run tests/scoring.test.ts
```

## Architecture

Vigil is a geopolitical threat intelligence dashboard. It aggregates data from prediction markets and global event databases, applies a multi-phase scoring algorithm, and renders a Bloomberg Terminal-style dark UI.

### Request Flow

```
Browser (VigilDashboard.tsx)
  → polls /api/dashboard every 15s
  → pipeline.ts: buildDashboardSnapshot()
      → sources.ts: fetch 5 APIs in parallel (Polymarket, Kalshi, GDELT, Alpha Vantage, CoinGecko)
      → scoring/core.ts → phase2.ts → phase3.ts: multi-phase threat scoring
      → degradation/sourceHealth.ts: classify each source as live/stale/delayed/offline
      → logging/hitRate.ts: append high-score threats (>60) to data/hit-rate-log.json
  → returns {globalRisk, gprIndex, threats[], sourceHealth}
```

### Key Modules

- **`lib/pipeline.ts`** — Main orchestrator; the only entry point to the scoring system
- **`lib/data/sources.ts`** — Fetches all 5 external APIs; gracefully falls back to mock data on failure
- **`lib/scoring/core.ts`** — Phase 1: GDELT volume normalization, confidence classification, severity capping, composite score computation
- **`lib/scoring/phase2.ts`** — Phase 2: favorite-longshot bias correction, correlation window selection, novel event AI trigger
- **`lib/scoring/phase3.ts`** — Phase 3: exponential/power-law decay, regime-switching correlation modes
- **`lib/config/constants.ts`** — `THREATS` seed data, `CATEGORY_WEIGHTS`, `SOURCE_STALE_AFTER_MS` (15 min)
- **`lib/types.ts`** — All shared TypeScript interfaces (`Threat`, `SourceState`, `Snapshot`, etc.)

### API Routes

| Route | Method | Notes |
|-------|--------|-------|
| `/api/dashboard` | GET | Returns full snapshot; main polling endpoint |
| `/api/analyze` | POST | `{threatTitle}` → LLM deep-dive; requires `GEMINI_API_KEY` |
| `/api/backtest` | GET | Historical hit-rate metrics from `data/hit-rate-log.json` |

### Environment Variables

Optional — app falls back to mock data if absent:
- `ALPHA_VANTAGE_API_KEY` — live stock quotes
- `COINGECKO_DEMO_API_KEY` — live crypto prices
- `GEMINI_API_KEY` — required for `/api/analyze`

### Styling

Uses CSS Modules + Tailwind CSS 4. Dark theme variables are defined in `app/globals.css`. The UI design spec (colors, typography, layout intent) is in `vigil-cursor-prompt.md` — consult it before making visual changes.

### Imports

TypeScript path alias `@/*` maps to the repo root (`flashpoint-app/`). Use `@/lib/...`, `@/components/...`, etc.
