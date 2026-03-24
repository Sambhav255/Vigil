**Vigil** — geopolitical event severity intelligence dashboard (Next.js).

## Requirements

**Node.js 20.x or 22.x (LTS).** Node 25+ breaks the Next.js server bundle. With [nvm](https://github.com/nvm-sh/nvm): `nvm install` / `nvm use` (reads `.nvmrc`). After switching Node, clear the build cache once: `rm -rf .next`.

If the folder lives on **OneDrive/iCloud** and installs or `next dev` hit timeouts, copy `vigil-app/` to a local path (for example `/tmp/vigil-app`) and run commands there.

## Local development

```bash
cp .env.example .env.local   # add API keys (all optional — app falls back to mock data)
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Environment variables

All variables are optional. The app renders with mock data when keys are absent.

| Variable | Purpose |
|---|---|
| `ALPHA_VANTAGE_API_KEY` | Live stock quotes (SPY, QQQ, TSLA, NVDA) |
| `COINGECKO_DEMO_API_KEY` | Live crypto prices (BTC, ETH) — falls back to Coinpaprika |
| `FRED_API_KEY` | Live macro indicators: CPI, unemployment, yield curve |
| `GEMINI_API_KEY` | Enables `/api/analyze` AI deep-dive |
| `NEXT_PUBLIC_CONVEX_URL` | Enables auth + persistent watchlists (Convex) |

## Deploy to Vercel

The repository root contains `vercel.json` with `rootDirectory: vigil-app`. In Vercel:

1. Set **Node.js** to **22.x** (matches `.nvmrc`).
2. Add environment variables from `.env.example` as needed.
3. Deploy. For **Convex Auth**, run `npx convex dev` locally first, then set `NEXT_PUBLIC_CONVEX_URL` in Vercel.

**CI:** `.github/workflows/ci.yml` runs lint, tests, and production build on every push/PR to `main` or `master`.

## Commands

```bash
npm run dev        # dev server on http://localhost:3000
npm run build      # production build
npm run lint       # ESLint
npm run test:run   # Vitest (single run / CI)
```
