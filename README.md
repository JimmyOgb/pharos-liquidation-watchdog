# Liquidation Watchdog

**Autonomous Cross-Network Lending Risk Sentinel & Interaction-Safety Monitor**

Liquidation Watchdog is a professional, non-custodial risk monitoring application for decentralized lending positions. It monitors on-chain collateral, debt, and health factors, issues timestamped alerts when positions approach liquidation thresholds, and computes deterministic remediation recommendations to restore positions to safety.

Operating via an **Agent-Native Cross-Network Gateway**, Liquidation Watchdog inspects verified lending markets on **Base Mainnet (Chain ID 8453)** powered by the **Aave V3 Protocol**, orchestrated through the **Pharos AI Ecosystem** with local SHA-256 cryptographic provenance logging.

---

## Key Features

- **Direct On-Chain Telemetry**: Inspects verified Aave V3 Pool and Oracle contracts directly on Base via high-availability JSON-RPC with automatic endpoint fallback.
- **Active Browser Sentinel**: Real-time configurable heartbeat polling (15s, 30s, 60s) with live countdown timers, animation pulse, and automated stale-data detection (>120s).
- **Hierarchical Risk Classification**:
  - `HEALTHY`: Health Factor safely above configured warning threshold.
  - `WARNING`: Health Factor entering cautious risk margin (default: $\le 1.30$).
  - `CRITICAL`: Health Factor approaching immediate liquidation danger (default: $\le 1.10$).
  - `LIQUIDATION RISK`: Health Factor at or below protocol liquidation parity ($\le 1.00$).
- **Deterministic Action Recommendations**:
  - **Debt Repayment**: Computes exact token repayment required to restore Health Factor to the target safety margin ($HF_{\text{target}}$).
  - **Asset-Specific Collateral Addition**: Calculates exact deposit required using the specific asset's liquidation threshold ($LT_{\text{asset}}$).
  - **Protocol Guardrail Enforcement**: Explicitly disallows zero-LTV assets (such as USDC on Base Aave V3) from collateral recommendations, preventing transaction reverts (`UserHasAssetWithZeroLtv()`).
  - **Mandatory Estimation Labeling**: Every recommendation is clearly disclaimed as `ESTIMATE — NOT AN EXECUTABLE TRANSACTION`.
- **Timestamped Alert Ledger**: Tracks threshold crossings, state transitions, and recovery events with 10-minute deduplication for minor fluctuations ($|\Delta HF| < 0.01$).
- **Cryptographic Provenance**: Computes SHA-256 digests for every RPC payload, oracle price quote, and Pharos MCP call for tamper-evident auditing.

---

## Architecture Overview

```
                      ┌────────────────────────────────────────┐
                      │          Liquidation Watchdog          │
                      │         (Active Browser Client)        │
                      └──────────────────┬─────────────────────┘
                                         │
                   ┌─────────────────────┴─────────────────────┐
                   ▼                                           ▼
       ┌──────────────────────┐                     ┌─────────────────────┐
       │   Base Mainnet RPC   │                     │  Pharos AI Gateway  │
       │   (Chain ID 8453)    │                     │   (Chain ID 1672)   │
       └───────────┬──────────┘                     └──────────┬──────────┘
                   │                                           │
         ┌─────────┴─────────┐                       ┌─────────┴─────────┐
         ▼                   ▼                       ▼                   ▼
   Aave V3 Pool        Aave Oracle             Pharos Chain MCP    Pharos Docs MCP
 (0xA238...d1c5)     (0x2Cc0...e156)           (Chain Status)      (Specs & Oracles)
         │                   │                       │                   │
         └─────────┬─────────┴───────────────────────┴───────────────────┘
                   ▼
       ┌──────────────────────┐
       │  Deterministic Risk  │
       │    Evaluator Engine  │
       └───────────┬──────────┘
                   ▼
       ┌──────────────────────┐
       │  Timestamped Alerts  │
       │   & Provenance Log   │
       └──────────────────────┘
```

---

## Quick Start & Installation

### Prerequisites

- Node.js 20+ (Node.js 24 recommended)
- npm 10+

### Installation

```bash
# Clone the repository
git clone https://github.com/JimmyOgb/pharos-liquidation-watchdog.git
cd pharos-liquidation-watchdog

# Install dependencies ($0-first, zero paid dependencies)
npm install
```

### Development & Local Execution

```bash
# Run type checking
npm run typecheck

# Run standalone development server
npm run dev

# Bundle production distribution
npm run build

# Start production server
npm start
```

Open `http://localhost:3000` in your web browser.

---

## Test Suite

The project includes deterministic unit tests covering the risk evaluator, alert system, and live on-chain integration tests against Base Mainnet and Pharos MCP endpoints.

```bash
# Run deterministic unit tests (17 test cases)
npm run test:unit

# Run live on-chain integration tests (5 test cases)
npm run test:integration

# Run entire test suite (22 test cases)
npm test
```

### Test Coverage Highlights

- **TC1–TC5**: Threshold hierarchy classification (`HEALTHY`, `WARNING`, `CRITICAL`, `LIQUIDATION RISK`).
- **TC6–TC7**: Mathematical precision of debt repayment calculations.
- **TC8**: Rejection of zero-LTV assets (USDC guardrail) with `UserHasAssetWithZeroLtv()` error classification.
- **TC9**: Asset-specific collateral addition calculations for WETH ($LT = 84\%$).
- **TC10**: Live borrower fixture verification (`0xcbc3301782507d85e57db83d7d19db2a82478570`).
- **TC11–TC15**: Alert generation on state transitions and recovery notifications.
- **TC16–TC17**: Alert deduplication window ($|\Delta HF| < 0.01$ within 10 minutes) and ledger filtering.
- **INT1–INT5**: Live Base RPC block height, pool account introspection, oracle price feeds, and Pharos MCP search.

---

## Preset Verification Fixtures

| Preset | Address | Description | Expected Status |
| :--- | :--- | :--- | :--- |
| **Verified Borrower** | `0xcbc3301782507d85e57db83d7d19db2a82478570` | Active borrower on Base Aave V3 holding cbBTC & WETH collateral against USDC debt | Active Collateral: cbBTC, WETH<br>Active Debt: USDC<br>Health Factor: ~4.10<br>Risk: `HEALTHY` |
| **Zero-Debt Baseline** | `0x0000000000000000000000000000000000000001` | Inactive address with zero collateral and zero debt | Health Factor: $\infty$<br>Risk: `HEALTHY`<br>Actions: None required |

---

## Important Disclosures

1. **Non-Custodial & Read-Only**: Liquidation Watchdog never requests private keys, seed phrases, or transaction signatures. All queries are strictly read-only `eth_call` queries.
2. **Monitoring Scope**: The Active Browser Sentinel operates while the web browser tab remains open. Polling automatically pauses when the tab is closed. Vercel Hobby serverless scheduled crons execute at most once every 24 hours.
3. **Remediation Disclaimer**: All repayment and collateral recommendations are mathematical estimates reflecting current on-chain state, oracle prices, and reserve configurations. They do not constitute financial advice or executable transactions.

---

## License

MIT License. Copyright (c) 2026 JimmyOgb.
