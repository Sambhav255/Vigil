# Flashpoint API Expansion: What the public-apis Repo Gives You

After going through the entire public-apis repository (1,400+ APIs across 50 categories), here are the APIs that would meaningfully improve Flashpoint — organized by which architectural gap each one fills, whether it's free, and what priority it should be.

---

## TIER 1: High-Impact, Free, Add Now

These directly strengthen existing force categories or fill gaps the current architecture can't cover.

### FRED (Federal Reserve Economic Data)
- **Category**: Macroeconomic Force
- **What it does**: 800,000+ economic time series — CPI, GDP, unemployment, Fed funds rate, yield curves, money supply, housing starts. Updated in real-time as releases happen.
- **Auth**: Free API key
- **Why it matters**: This is the single biggest upgrade possible to the Macro force category. Right now you're relying on Kalshi prediction markets to *infer* macro conditions. FRED gives you the **actual data** — you can detect when CPI surprises to the upside before narrative forms, because you have the print itself. A CPI reading 0.3% above consensus is a computable signal, not a prediction market guess.
- **Integration**: Poll on release schedule (BLS publishes CPI on known dates). Compare actual vs consensus. Delta feeds directly into Macro force score.
- **Cost**: Free, 120 requests/min
- **Priority**: Phase 1. This should have been in the original PRD.

### USGS Earthquake Hazards Program
- **Category**: Climate/Natural Force
- **What it does**: Real-time earthquake data globally — location, magnitude, depth, tsunami warnings. GeoJSON feeds update every minute for significant events.
- **Auth**: None
- **Why it matters**: The Climate/Natural force category currently has no structured data source for natural disasters — it relies entirely on GDELT keyword volume. A 7.0+ earthquake near a semiconductor fab in Taiwan, an oil refinery in Japan, or a shipping chokepoint is an immediate, quantifiable supply chain threat. The USGS API gives you magnitude, location coordinates, and tsunami risk — you can cross-reference against a geolocated asset sensitivity map automatically.
- **Integration**: Poll the "significant earthquakes" feed (M4.5+) every 5 minutes. Geofence check against known critical infrastructure coordinates. Auto-generate threat cards when magnitude × proximity exceeds threshold.
- **Cost**: Free, no auth, no rate limit on feeds
- **Priority**: Phase 1

### SEC EDGAR
- **Category**: Regulatory Force
- **What it does**: Real-time SEC filings — 10-K, 10-Q, 8-K, insider trading (Form 4), new enforcement actions. Full-text search across all public company filings.
- **Auth**: None (requires User-Agent header with contact info)
- **Why it matters**: SEC enforcement actions are a direct Regulatory force signal. An 8-K filing from NVDA about a DOJ subpoena hits EDGAR before it hits Reuters. Insider selling spikes (aggregated Form 4 data) can be a leading indicator of upcoming bad news. The current architecture has zero visibility into regulatory filings.
- **Integration**: Poll the EDGAR full-text search API for keywords matching your threat dictionary (e.g., "subpoena," "investigation," "cease and desist"). New filings matching high-weight keywords generate threat cards in the Regulatory category.
- **Cost**: Free, 10 requests/sec
- **Priority**: Phase 2

### Econdb
- **Category**: Macroeconomic Force
- **What it does**: Global macroeconomic data from 90+ statistical agencies — GDP, industrial production, trade balances, PMI indices across countries. Covers emerging markets that FRED doesn't.
- **Auth**: None
- **Why it matters**: FRED is US-centric. Flashpoint's geopolitical threats are global. A Chinese GDP miss, a Eurozone PMI collapse, or a Turkish lira crisis all affect your asset universe. Econdb fills the international macro gap.
- **Integration**: Supplement FRED for non-US macro indicators. Key series: China PMI, Eurozone GDP, Japan industrial production.
- **Cost**: Free
- **Priority**: Phase 2

### Finnhub (upgrade from Alpha Vantage)
- **Category**: Market Data
- **What it does**: Real-time stock quotes, forex, crypto, economic calendar, company news, insider transactions, SEC filings, earnings surprises. WebSocket support for streaming.
- **Auth**: Free API key
- **Why it matters**: Already noted as the Phase 2 upgrade path from Alpha Vantage. But the public-apis repo confirms Finnhub also provides an **economic calendar** (scheduled data releases with consensus estimates) and **earnings surprises** — both are structured inputs that your current architecture has no source for. Knowing that CPI prints tomorrow at 8:30am lets you pre-position threat cards. Knowing NVDA missed earnings by 15% is an automatic sentiment signal.
- **Integration**: Replace Alpha Vantage for market data. Add economic calendar polling for pre-scheduling threat escalation windows. Add earnings surprise feed as a sentiment signal.
- **Cost**: Free tier: 60 API calls/min
- **Priority**: Phase 2 (but consider Phase 1 if Alpha Vantage rate limits bite)

---

## TIER 2: Medium-Impact, Free, Add in Phase 2-3

These add meaningful capability but aren't critical for MVP.

### Coinpaprika or CoinCap
- **Category**: Market Data (Crypto)
- **What it does**: Crypto prices, market cap, volume, exchange data. CoinCap provides WebSocket streaming. Coinpaprika has no auth required and generous limits.
- **Auth**: None (both)
- **Why it matters**: CoinGecko's free tier (10k calls/month) may not be enough if you add more crypto assets or increase polling frequency. Coinpaprika is a free fallback with no rate limits listed. CoinCap adds real-time streaming via WebSocket.
- **Integration**: Use as degradation fallback for CoinGecko. If CoinGecko goes down or hits rate limits, swap to Coinpaprika seamlessly.
- **Cost**: Free
- **Priority**: Phase 2 — degradation resilience

### WallstreetBets Sentiment (nbshare)
- **Category**: Sentiment Force
- **What it does**: Sentiment analysis of WallstreetBets stock comments. Tracks which tickers are being discussed and overall sentiment polarity.
- **Auth**: None
- **Why it matters**: Retail sentiment is a genuine force multiplier. GameStop 2021 proved that retail narrative momentum can overwhelm fundamentals. If a ticker suddenly spikes in WSB mention volume with negative sentiment, that's a quantifiable input to your Sentiment force score.
- **Integration**: Poll daily. Map mentioned tickers to your asset universe. Volume spike = sentiment signal.
- **Cost**: Free
- **Priority**: Phase 3

### OpenAQ (Air Quality)
- **Category**: Climate/Natural Force
- **What it does**: Real-time air quality data from monitoring stations globally.
- **Auth**: Free API key
- **Why it matters**: Extreme air quality events (wildfire smoke, industrial pollution) can signal supply chain disruptions before they're reported as news. Poor air quality in major Chinese manufacturing regions correlates with factory shutdowns.
- **Integration**: Monitor PM2.5 levels in key manufacturing/agricultural regions. Spike detection feeds into Climate force score.
- **Cost**: Free
- **Priority**: Phase 3

### UK Carbon Intensity / National Grid ESO
- **Category**: Climate/Natural Force + Supply Chain
- **What it does**: Real-time energy grid data for UK. Carbon intensity, generation mix, demand forecasting.
- **Auth**: None
- **Why it matters**: Energy grid stress is a leading indicator for energy price spikes. If UK grid demand exceeds generation capacity, natural gas prices react. Same pattern applies broadly.
- **Integration**: Monitor grid stress indicators as early warning for energy commodity moves.
- **Cost**: Free
- **Priority**: Phase 3

### NASA (EONET - Earth Observatory Natural Event Tracker)
- **Category**: Climate/Natural Force
- **What it does**: Tracks natural events — wildfires, severe storms, volcanic eruptions, sea/lake ice extent. Structured JSON with event type, coordinates, and dates.
- **Auth**: None (optional API key for higher limits)
- **Why it matters**: Complements USGS earthquakes with the rest of the natural disaster spectrum. Wildfires near California tech campuses, volcanic eruptions disrupting Pacific flight routes, severe storms threatening Gulf refineries — all structured, geolocated, and machine-readable.
- **Integration**: Poll EONET API for active events. Geofence against critical infrastructure map. Auto-generate Climate/Natural threat cards.
- **Cost**: Free
- **Priority**: Phase 2

### Fed Treasury (Fiscal Data)
- **Category**: Macroeconomic Force
- **What it does**: US Treasury data — national debt, deficit, Treasury auction results, daily Treasury yields.
- **Auth**: None
- **Why it matters**: Treasury auction results (bid-to-cover ratios, foreign participation) are macro signals that move bond markets. A failed or weak Treasury auction = higher yields = equity pressure. This is quantifiable data, not news sentiment.
- **Integration**: Poll Treasury auction schedule. Compare bid-to-cover ratios against historical averages. Anomaly detection feeds into Macro force score.
- **Cost**: Free
- **Priority**: Phase 2

---

## TIER 3: Niche but Useful

### Open Charge Map
- **Category**: Technological Force
- **What it does**: Global registry of EV charging locations.
- **Why it matters**: Very niche, but for tracking EV infrastructure buildout as a signal for TSLA/EV sector thesis validation. Low priority.

### MarketAux
- **Category**: Sentiment Force
- **What it does**: Stock market news with tagged tickers and sentiment scores. ML-powered.
- **Auth**: Free API key
- **Why it matters**: Pre-tagged ticker-level sentiment is exactly what the keyword scorer needs but currently has to derive from raw headlines. MarketAux does the ticker tagging for you.
- **Integration**: Use as supplementary sentiment signal alongside GDELT. Cross-validate sentiment polarity between the two sources.
- **Cost**: Free tier available
- **Priority**: Phase 2-3

### GNews
- **Category**: News Ingestion
- **What it does**: Search for news from various sources with topic/keyword filtering.
- **Auth**: Free API key
- **Why it matters**: Additional news source for corroboration engine. Currently relying on GDELT + RSS. A third independent news source strengthens the three-way corroboration requirement for Critical severity.
- **Cost**: Free tier: 100 requests/day
- **Priority**: Phase 2

### OpenSky Network
- **Category**: Geopolitical Force
- **What it does**: Free real-time ADS-B aviation data — tracks all commercial and military aircraft with transponders.
- **Auth**: None
- **Why it matters**: Military aircraft positioning changes are leading indicators of geopolitical escalation. AWACS deployment patterns, carrier-based aircraft activity, increased military transport flights to a region — these are detectable signals. Open source intelligence (OSINT) analysts already use OpenSky for this.
- **Integration**: Advanced. Would need a geofence system around conflict zones to detect military aviation anomalies. High effort, high signal if done right.
- **Cost**: Free
- **Priority**: Phase 3 (requires significant implementation effort)

---

## APIs From the Repo That Look Relevant But Should Be SKIPPED

### Yahoo Finance API (listed in Finance section)
Already disqualified — TOS violation, reliability issues. Confirmed in our earlier review.

### Polygon.io (listed in Finance section)
Good API, but costs $29/month. Violates the "no paid APIs" constraint for MVP. Keep as Phase 2+ upgrade.

### CoinGecko (already in stack)
Already using this. No change needed.

### Alpha Vantage (already in stack)
Already using this. Finnhub is the Phase 2 upgrade.

### The Guardian / NYT / NewsAPI (News section)
These require API keys and have restrictive terms for commercial use. GNews is a better supplementary news source with cleaner terms. NewsAPI's free tier is development-only and prohibits production use.

### VirusTotal / URLScan (Security section)
Useful for a cybersecurity product, but Flashpoint tracks geopolitical risk to assets, not individual cyber threats. The "cyberattacks on infrastructure" sub-signal is better captured through GDELT keyword volume on terms like "cyberattack" + "pipeline" than through malware databases.

---

## Revised Data Source Architecture

Here's how the full stack looks after incorporating Tier 1 and Tier 2 additions:

### Prediction Markets (probability layer)
1. Polymarket Gamma API — geopolitical + crypto events (free, no auth)
2. Kalshi API — macro events: Fed, CPI, GDP, S&P targets (free account)

### News & Event Data (headline ingestion)
3. GDELT Project — global headline volume + source metadata (free, no auth)
4. RSS Feeds — Reuters, AP, FT, WSJ (free, no auth)
5. GNews API — supplementary news search with keyword filtering (free key, 100/day) [NEW]

### Market Data
6. Alpha Vantage → Finnhub — stock prices, economic calendar, earnings (free key)
7. CoinGecko + Coinpaprika fallback — crypto prices (free)

### Macroeconomic Data [NEW LAYER]
8. FRED API — US economic data: CPI, GDP, unemployment, yields (free key)
9. Econdb — international macro: China PMI, Eurozone GDP (free, no auth)
10. Fed Treasury — auction results, daily yields, national debt (free, no auth)

### Natural Disaster & Climate Data [NEW LAYER]
11. USGS Earthquake API — real-time global seismic data (free, no auth)
12. NASA EONET — wildfires, storms, volcanic eruptions (free, no auth)

### Regulatory & Filing Data [NEW LAYER]
13. SEC EDGAR — enforcement actions, 8-K filings, insider trading (free)

### Geopolitical Stress Index
14. Caldara-Iacoviello GPR Index — academic standard (free CSV)

### Sentiment
15. WallstreetBets Sentiment — retail sentiment polarity (free, no auth) [Phase 3]
16. MarketAux — ML-tagged ticker sentiment (free key) [Phase 3]

### AI Backend
17. Google Gemini 2.5 Flash — novel event classification, spike explanation (free tier)

**Total paid APIs: 0. Total new data sources: 7. All free.**

---

## What This Changes Architecturally

The biggest shift is that Flashpoint moves from a **reactive** system (wait for news → score it) to a **proactive** system that can detect conditions before they become news:

- FRED detects a CPI overshoot at 8:30am the second the data drops, before any article is written
- USGS detects a 7.2 earthquake near TSMC's Hsinchu fab in real-time, before Reuters dispatches a reporter
- SEC EDGAR detects an NVDA 8-K filing about a DOJ subpoena before the press release
- Fed Treasury detects a weak auction (low bid-to-cover) before bond market commentary explains why yields spiked

This transforms the cascade timer from "how much time until the market prices this in" to "we saw this before the news cycle started." That's the actual value proposition — and these APIs make it concrete rather than aspirational.

