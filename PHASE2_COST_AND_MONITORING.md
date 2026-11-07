# Phase 2 — Cost & Monitoring Analysis: Free-Tier Viability

**Project:** Liquidation Watchdog  
**Workspace:** `C:\Users\NO GO NO\PharosBuild\skills\pharos-liquidation-watchdog`  
**Deployment Target:** Vercel (Hobby / Free Plan)  
**Execution Phase:** Phase 2 Discovery & Feasibility  

---

## 1. Zero-Cost Infrastructure Audit

To comply with the strict project constraint that no paid services, subscriptions, paid AI models, or gas expenditures may be used, every layer of the infrastructure has been audited for free-tier sustainability:

| Infrastructure Layer | Selected Provider / Source | Cost | Free Tier Limits & Policies |
|---|---|:---:|---|
| **EVM Chain RPC (Base)** | Public Base Node (`https://mainnet.base.org`) & Fallbacks (`https://1rpc.io/base`) | **$0.00** | Generous rate limits for standard `eth_call` read operations. |
| **Pharos Chain MCP** | Official Hosted Endpoint (`https://mcp.pharos.xyz/mcp`) | **$0.00** | Read-only public MCP server hosted by Pharos Network. |
| **Pharos Docs MCP** | Official Hosted Endpoint (`https://docs.pharos.xyz/~gitbook/mcp`) | **$0.00** | Free public documentation search server. |
| **Web Hosting & API** | Vercel Hobby Plan | **$0.00** | Free hosting for static assets and serverless functions (`/api/*`). |
| **Alert Engine** | Client-Side In-Memory & LocalStorage Event Store | **$0.00** | Zero cloud database costs; instant persistence across reloads. |
| **Total Operating Cost** | | **$0.00 / month** | **100% Free Forever** |

---

## 2. Vercel Hobby Tier Capabilities & Scheduling Constraints

A critical investigation of the Vercel Hobby (Free) plan reveals important platform characteristics that shape the monitoring design:

### Vercel Hobby Constraints
- **Vercel Cron Limitations:** On the free Hobby plan, Vercel allows a maximum of **1 cron execution per day** (`0 0 * * *`). It does **not** permit minute-by-minute or hourly automated cron jobs. Attempting to schedule high-frequency crons triggers deployment failures or billing upgrades.
- **Serverless Execution Timeout:** 10 seconds default max execution duration.
- **Cold Starts:** Serverless functions sleep when idle; background Node.js daemon loops cannot run continuously without an active incoming HTTP request.

### The Honest Monitoring Architecture
Because of Vercel Hobby's constraints, the application will **not** mislead users by falsely claiming 24/7 background cloud daemon monitoring. Instead, it implements a reliable **Dual-Cadence Watchdog System**:

```
+------------------------------------------------------------------------------------+
|                         DUAL-CADENCE MONITORING ARCHITECTURE                       |
+------------------------------------------------------------------------------------+
|                                                                                    |
|  1. ACTIVE BROWSER SENTINEL (High Frequency: 15s / 30s / 60s)                      |
|     - Runs while the dashboard is open in any browser tab.                         |
|     - Issues live RPC queries directly, recalculates HF, detects threshold crosses.|
|     - Dispatches instant browser notifications and dashboard audio/visual alerts.  |
|     - Displays active "Live Heartbeat" pulse and countdown to next tick.           |
|                                                                                    |
|  2. ON-DEMAND MANUAL REFRESH                                                       |
|     - User can trigger an immediate on-chain re-evaluation at any second.          |
|                                                                                    |
|  3. VERCEL CRON DAILY BASELINE SNAPSHOT                                            |
|     - Configured in vercel.json (1/day) to log position health to server logs.     |
|                                                                                    |
+------------------------------------------------------------------------------------+
```

---

## 3. Rate Limits & Public RPC Resilience

### Observations from Live Testing
- `eth_call` queries to `https://mainnet.base.org` for `getUserAccountData` have sub-200ms latency and zero throttling during normal monitoring.
- `eth_getLogs` is strictly limited on public RPCs; therefore, the runtime monitoring engine relies exclusively on lightweight `eth_call` state reads for the monitored wallet address, avoiding heavy log-scraping in production.

### Multi-RPC Redundancy
If `https://mainnet.base.org` experiences temporary congestion, the gateway automatically rotates through verified public fallback endpoints:
1. Primary: `https://mainnet.base.org`
2. Secondary: `https://1rpc.io/base`
3. Tertiary: `https://base-rpc.publicnode.com`

---

## 4. Alert Deduplication & History Management

To prevent alert fatigue and redundant notifications:
1. **Threshold-Crossing Detection:** An alert is triggered only when the position transitions across a boundary (e.g. from `HEALTHY` to `WARNING`, or `WARNING` to `CRITICAL`).
2. **Alert Deduplication Window:** Identical alerts within a 10-minute window with negligible health factor delta ($|\Delta HF| < 0.01$) are suppressed.
3. **Recovery Notifications:** When a user repays debt or adds collateral, transitioning back to `HEALTHY`, a green `RECOVERY` event is recorded.
4. **Local Audit History:** All timestamped alert events are persisted in `localStorage` and visible in an interactive **Alert Ledger** with full evidence provenance.
