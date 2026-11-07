# Phase 4 Vercel Deployment Report — Liquidation Watchdog

**Product:** Liquidation Watchdog  
**Deployment Platform:** Vercel  
**Account:** `jamism123`  
**Plan Tier:** Free Hobby  
**Project Name:** `pharos-liquidation-watchdog`  
**Production URL:** https://pharos-liquidation-watchdog-seven.vercel.app/  
**Deployment ID:** `dpl_CqKGRXjhTKsxSCqeTMY3ZZiG6gbS`  
**Ready State:** `READY`  
**Target:** `production`  
**Build Machine:** Washington, D.C., USA (East) – `iad1` (2 cores, 8 GB memory)  
**Deployment Timestamp:** 2026-11-07T18:37:03Z  

---

## 1. Build & Serverless Packaging Pipeline

Vercel deployment utilized the optimized build pipeline configured in `vercel.json` and `scripts/build.js`:

```text
> pharos-liquidation-watchdog@1.0.0 build
> tsc --noEmit && node scripts/build.js

[build] Bundling standalone server for production...
[build] Successfully generated dist/server.js
[build] Bundling Vercel serverless functions (api/*.js)...
  -> Built api/health.js
  -> Built api/watch.js
  -> Built api/reserves.js
  -> Built api/alerts.js
[build] All serverless functions packaged successfully.
Build Completed in /vercel/output [4s]
```

### Output Configuration
- **Static Frontend Directory**: `public/` (`index.html`, `styles.css`, `app.js`).
- **Serverless Edge Functions**:
  - `GET /api/health`: Health status, network metadata, and contract addresses.
  - `POST /api/watch`: Lending position inspection, risk evaluation, and alert generation.
  - `GET /api/reserves`: Verified reserves list with live oracle prices.
  - `GET /api/alerts`: In-memory alert history querying.

---

## 2. Plan Limitations & Cost Verification

- **Total Cost**: **$0.00** ($0-first architecture, zero paid add-ons, zero database charges).
- **Scheduled Cron Limits**: Vercel Hobby limits cron execution to once every 24 hours (`0 0 * * *`). Configured in `vercel.json` pointing to `/api/health`.
- **Active Browser Sentinel**: Continuous monitoring operates via browser polling (15s, 30s, 60s) while the tab is active. Background monitoring is explicitly disclaimed.
- **Security Headers**: Strict CSP, `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`, `Referrer-Policy: strict-origin-when-cross-origin` applied via `vercel.json`.
