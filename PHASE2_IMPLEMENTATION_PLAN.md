# Phase 2 — Implementation Plan: Liquidation Watchdog

**Project:** Liquidation Watchdog  
**Workspace:** `C:\Users\NO GO NO\PharosBuild\skills\pharos-liquidation-watchdog`  
**Execution Phase:** Phase 2.1.1 Final Implementation Roadmap  

---

## 1. Implementation Roadmap

Following review and approval of the Phase 2.1.1 numerical reconciliation, implementation will proceed through the following verified stages:

```
+---------------------------+     +--------------------------+     +-------------------------+     +--------------------------+
| Stage 1: Core Engine SDK  | --> | Stage 2: Web Sentinel UI | --> | Stage 3: Test Suite     | --> | Stage 4: Publication &   |
| (RPC, Math & Alerts)      |     | (Gauge, Cards & Alerts)  |     | (Unit & Live Integ)     |     | Deployment               |
+---------------------------+     +--------------------------+     +-------------------------+     +--------------------------+
```

### Stage 1: Core Engine & Protocol SDK
- **Package Configuration:** Minimal Node.js 20+ project with TypeScript 5.7+ (`tsconfig.json`, `package.json`, `esbuild`).
- **`src/protocols/aaveV3Base.ts`:**
  - Multi-RPC client (`https://mainnet.base.org` with fallback to `https://1rpc.io/base`).
  - Calls `getUserAccountData` on Pool `0xA238Dd80C259a72e81d7e4664a9801593F98d1c5`.
  - Calls `getAssetPrice` on Aave Oracle `0x2Cc0Fc26eD4563A5ce5e8bdcfe1A2878676Ae156`.
  - Queries `balanceOf` on reserve `aTokens` and `variableDebtTokens`.
  - Decodes token decimals and asset-level metadata.
- **`src/engine/riskEvaluator.ts`:**
  - Evaluates user thresholds (Warning, Critical, Safety Target).
  - Computes exact debt repayment $\Delta D_{\text{USD}}$ and token units (with floor rounding).
  - Computes asset-specific collateral addition $\Delta C_{\text{USD}}$ using $LT_{\text{asset}}$ (with ceiling rounding).
  - Flags edge cases: zero debt ($HF = \infty$), zero collateral with debt ($HF = 0$), already healthy ($HF \ge HF_{\text{target}}$).
- **`src/engine/alertSystem.ts`:**
  - Detects threshold-crossing events.
  - Enforces 10-minute alert deduplication window for $|\Delta HF| < 0.01$.
  - Generates green `RECOVERY` alerts when health improves back to `HEALTHY`.
- **`src/mcp/pharosClients.ts`:**
  - Pharos Developer Docs MCP client (`https://docs.pharos.xyz/~gitbook/mcp`).
  - Pharos Chain MCP client (`https://mcp.pharos.xyz/mcp`).
  - Local SHA-256 evidence hashing registry.
- **Serverless API Routes (`api/watch.js`, `api/health.js`, `api/cron.js`):**
  - Standalone bundled routes optimized for Vercel Hobby serverless runtime.

### Stage 2: Modern Institutional Web Dashboard
- Single-page interface in `public/index.html`, `public/styles.css`, and `public/app.js`:
  - Institutional dark theme with glowing neon health-factor gauge.
  - Live network status indicators (Base Mainnet 8453, Pharos Chain MCP 1672, Docs MCP).
  - Preloaded verified live borrower preset button (`0xcbc3...8570`).
  - Configurable threshold sliders (Warning default `1.30`, Critical default `1.10`, Safety Target default `1.50`).
  - Active browser sentinel polling loop (15s / 30s / 60s) with visible pulse and countdown.
  - Stale-data warning badge when last observation exceeds 120 seconds.
  - Asset-level breakdown cards (cbBTC, USDC, WETH) with collateral enablement indicators ("Active Collateral" vs "Yield Only").
  - Concrete recommendations card with exact dollar and token estimates for repayment and asset-specific collateral addition.
  - Interactive Alert Ledger with severity badges, timestamps, and exportable history.

### Stage 3: Comprehensive Test Suite
- **Unit Tests (`tests/unit/*.test.ts`):**
  1. Address sanitization & checksumming.
  2. Health-factor mathematical precision against protocol formula (0 wei variance on unrounded BigInts).
  3. Repayment recommendation calculation across various debt assets.
  4. Asset-specific collateral addition accounting for $LT_{\text{asset}}$ for eligible assets (cbBTC, WETH).
  5. Zero-LTV asset rejection (ensuring USDC with 0% LTV is rejected from collateral recommendations).
  6. Zero-debt edge case ($HF = \infty$).
  7. Zero-collateral edge case ($HF = 0$).
  8. Threshold validation (rejecting negative or inverted thresholds).
  9. Alert deduplication and threshold-crossing state transitions.
  10. Stale-data detector.
  11. Local SHA-256 evidence hashing integrity.
- **Live Integration Tests (`tests/integration/*.test.ts`):**
  1. Live read of Pool Proxy `0xA238Dd80C259a72e81d7e4664a9801593F98d1c5`.
  2. Live read of Aave Oracle `0x2Cc0Fc26eD4563A5ce5e8bdcfe1A2878676Ae156`.
  3. Real position retrieval for `0xcbc3301782507d85e57db83d7d19db2a82478570`.
  4. Real empty wallet check for `0x0000000000000000000000000000000000000001`.
  5. Live query against Pharos Docs MCP and Chain MCP.

### Stage 4: Publication, Deployment & Demo Video
- Initialize Git repository at `C:\Users\NO GO NO\PharosBuild\skills\pharos-liquidation-watchdog`.
- Stage and commit with clean conventional commits.
- Publish to public GitHub repository `https://github.com/JimmyOgb/pharos-liquidation-watchdog`.
- Deploy to Vercel at `https://pharos-liquidation-watchdog.vercel.app/`.
- Record live walkthrough demonstration video using Playwright screen capture and TTS narration.

---

## 2. Directory Layout

```
pharos-liquidation-watchdog/
├── api/                             # Vercel serverless function entry points
│   ├── cron.js                      # Daily baseline check
│   ├── health.js                    # Health check & network status
│   └── watch.js                     # Position inspection, risk & action engine
├── docs/                            # In-depth architectural & evidence docs
│   ├── ALERTS_AND_THRESHOLDS.md
│   ├── ARCHITECTURE.md
│   ├── LIVE_EVIDENCE_REPORT.md
│   ├── PROTOCOL_INTEGRATION.md
│   └── SECURITY.md
├── public/                          # Institutional Web Frontend
│   ├── app.js                       # Frontend sentinel controller
│   ├── index.html                   # Modern dashboard layout
│   └── styles.css                   # Responsive dark institutional styling
├── scripts/
│   └── build.js                     # esbuild bundler
├── src/                             # TypeScript core source files
│   ├── config/                      # Endpoints, addresses & defaults
│   ├── engine/                      # Deterministic risk & alert engine
│   ├── mcp/                         # Pharos Chain & Docs MCP clients
│   ├── protocols/                   # Aave V3 Base RPC connectors
│   └── types/                       # Strict TypeScript interfaces
├── tests/
│   ├── integration/                 # Live on-chain integration tests
│   └── unit/                        # Deterministic offline unit tests
├── .env.example
├── .gitignore
├── LICENSE
├── package.json
├── PHASE2_ARCHITECTURE.md
├── PHASE2_COST_AND_MONITORING.md
├── PHASE2_IMPLEMENTATION_PLAN.md
├── PHASE2_LIVE_EVIDENCE.md
├── PHASE2_PROTOCOL_DISCOVERY.md
├── PHASE2_1_FINAL_VERIFICATION_REPORT.md
├── PHASE2_1_1_RECONCILIATION_REPORT.md
├── README.md
├── SKILL.md
├── tsconfig.json
└── vercel.json
```

---

## 3. Strict Stop Condition

Execution stops immediately after this verification gate report is produced. No application code, Git repository, or Vercel deployment will be initiated until the user reviews and provides explicit authorization for Phase 3.
