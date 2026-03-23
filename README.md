# Vigil

Real-time geopolitical event severity intelligence dashboard.

## Overview

Vigil aggregates prediction market data, global news events, macroeconomic indicators, and natural disaster feeds into a Bloomberg Terminal-style dark UI. It applies a multi-phase scoring algorithm to surface the highest-impact geopolitical threats to financial assets.

## Structure

```
vigil-app/    — Next.js 16 app (production)
docs/         — API research, product requirements
```

## Quick Start

**Requires Node.js 20.x or 22.x.** Node 25+ is not supported.

```bash
cd vigil-app
cp .env.example .env.local   # API keys are optional — app uses mock data as fallback
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Data Sources

| Source | Category | Auth |
|---|---|---|
| Polymarket | Prediction markets | None |
| Kalshi | Prediction markets | None |
| GDELT | News volume | None |
| USGS Earthquakes | Natural disasters | None |
| NASA EONET | Natural events | None |
| CoinGecko + Coinpaprika | Crypto prices | Optional key |
| Alpha Vantage | Stock quotes | Optional key |
| FRED | Macro indicators | Optional key |
| Gemini AI | Threat analysis | Optional key |

## Deploy

1. **Node.js** — Use **20.x or 22.x** (see `vigil-app/.nvmrc` and `engines` in `vigil-app/package.json`). Node 25+ is not supported.
2. **Vercel** — Import the repo into [Vercel](https://vercel.com). Root `vercel.json` sets `rootDirectory` to `vigil-app`. In Project → Settings → General, set **Node.js Version** to **22.x** (recommended).
3. **Environment variables** — Copy `vigil-app/.env.example` into Vercel. All keys are optional for a first deploy; add API keys for live data and `NEXT_PUBLIC_CONVEX_URL` if you use Convex Auth.
4. **Convex (optional)** — From `vigil-app/`, run `npx convex dev` once to link a project and deploy functions. Set `NEXT_PUBLIC_CONVEX_URL` in Vercel. GitHub OAuth callback: `https://<your-deployment>.convex.site/api/auth/callback/github`.
5. **CI** — GitHub Actions runs `lint`, `test:run`, and `build` on `vigil-app/` for pushes and PRs to `main`/`master`.

## Repository

[github.com/Sambhav255/Vigil](https://github.com/Sambhav255/Vigil)
