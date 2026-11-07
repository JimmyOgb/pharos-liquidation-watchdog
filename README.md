# Liquidation Watchdog

**Autonomous Cross-Network Lending Risk Sentinel & Interaction-Safety Monitor**

**Live Application:** https://pharos-liquidation-watchdog-seven.vercel.app/  
**Public Repository:** https://github.com/JimmyOgb/pharos-liquidation-watchdog  
**Target Lending Protocol:** Aave V3 on Base Mainnet (Chain ID `8453`)  
**Ecosystem Orchestration:** Pharos AI (Chain ID `1672`) via Model Context Protocol (MCP)  
**Security Model:** 100% Non-Custodial, Read-Only, Zero Private Keys, Zero Blockchain Transactions  

---

## Overview

Liquidation Watchdog is a specialized, institutional-grade lending position monitoring dashboard. It tracks collateral, debt, and liquidation health factors in real time, warns borrowers before positions enter critical territory, and computes deterministic, asset-specific remediation actions to bring positions back to safety.

Operating via an **Agent-Native Cross-Network Gateway**, Liquidation Watchdog inspects verified lending pools on **Base Mainnet (8453)**, validates market parameters against the verified **Aave Oracle**, and orchestrates risk intelligence through the **Pharos AI Ecosystem** with local SHA-256 cryptographic provenance logging.

---

## Key Features

- **Direct Protocol Telemetry**: Introspects verified Base Aave V3 Pool (`0xA238Dd80C259a72e81d7e4664a9801593F98d1c5`) and Aave Oracle (`0x2Cc0Fc26eD4563A5ce5e8bdcfe1A2878676Ae156`) contracts with automatic multi-RPC fallback.
- **Active Browser Sentinel**: Real-time configurable heartbeat polling (15s, 30s, 60s) with live countdown timers, animation pulse, and automated stale-data detection (>120s).
- **Hierarchical Risk Classification**:
  - `HEALTHY`: Health Factor safely above warning threshold ($HF > 1.30$).
  - `WARNING`: Health Factor entering cautious risk margin ($1.10 < HF \le 1.30$).
  - `CRITICAL`: Health Factor approaching immediate liquidation danger ($1.00 < HF \le 1.10$).
  - `LIQUIDATION RISK`: Health Factor at or below protocol liquidation parity ($HF \le 1.00$).
- **Deterministic Action Recommendations**:
  - **Debt Repayment**: Computes exact token repayment required to restore Health Factor to the target safety margin ($HF_{\text{target}}$) using floor integer rounding.
  - **Asset-Specific Collateral Addition**: Calculates exact deposit required using the specific asset's liquidation threshold ($LT_{\text{asset}}$) and ceiling integer units.
  - **Protocol Guardrail Enforcement**: Explicitly disallows zero-LTV assets (such as USDC on Base Aave V3) from collateral recommendations, preventing transaction reverts (`UserHasAssetWithZeroLtv()` error `0x21e5c4ae`).
  - **Mandatory Estimation Labeling**: Every recommendation is clearly labeled as `ESTIMATE — NOT AN EXECUTABLE TRANSACTION`.
- **Timestamped Alert Ledger**: Tracks threshold crossings, state transitions, and recovery events with 10-minute deduplication for minor market drift ($|\Delta HF| < 0.01$).
- **Cryptographic Provenance**: Computes local SHA-256 digests for every RPC payload, oracle price quote, and Pharos MCP call for tamper-evident auditing.

---

## Architecture Topology

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

## Verified On-Chain Deployments (Base Mainnet — 8453)

| Contract / Asset | Address | Role & Decimals |
| :--- | :--- | :--- |
| **Aave V3 Pool Proxy** | `0xA238Dd80C259a72e81d7e4664a9801593F98d1c5` | Core lending position introspection (`getUserAccountData`) |
| **Aave Oracle** | `0x2Cc0Fc26eD4563A5ce5e8bdcfe1A2878676Ae156` | Verified base currency price feed (USD, 8 decimals) |
| **cbBTC** | `0xcbb7c0000ab88b473b1f5afd9ef808440eed33bf` | Collateral eligible (LTV 81%, LT 84%, 8 decimals) |
| **WETH** | `0x4200000000000000000000000000000000000006` | Collateral eligible (LTV 81%, LT 84%, 18 decimals) |
| **USDC** | `0x833589fcd6edb6e08f4c7c32d4f71b54bda02913` | Yield-only deposit & borrow debt (LTV 0%, LT 78%, 6 decimals) |
| **cbETH** | `0x2ae3f1ec7f1f5012cfeab0185bfc7aa3cf0dec22` | Collateral eligible (LTV 75%, LT 78%, 18 decimals) |
| **wstETH** | `0xc1cba3fcea344f92d9239c08c0568f6f2f0ee452` | Collateral eligible (LTV 75%, LT 78%, 18 decimals) |

---

## Quick Start & Installation

### Prerequisites

- Node.js 20+ (Node.js 24 recommended)
- npm 10+

### Local Installation

```bash
# Clone the repository
git clone https://github.com/JimmyOgb/pharos-liquidation-watchdog.git
cd pharos-liquidation-watchdog

# Install zero-cost dev dependencies
npm install

# Run static type checking
npm run typecheck

# Run standalone development server
npm run dev

# Bundle production distribution
npm run build

# Start standalone server
npm start
```

Access the dashboard at `http://localhost:3000`.

---

## Test Suite Execution

The project features a 22-test automated suite comprising 17 deterministic unit tests and 5 live on-chain integration tests:

```bash
# Run unit tests only (TC1-TC17)
npm run test:unit

# Run live on-chain integration tests against Base (INT1-INT5)
npm run test:integration

# Run full test suite (22 tests)
npm test
```

### Verified Test Matrix Highlights
- **TC1–TC5**: Hierarchy classification (`HEALTHY`, `WARNING`, `CRITICAL`, `LIQUIDATION RISK`).
- **TC6–TC7**: Debt repayment formula precision and threshold boundary verification.
- **TC8**: Rejection of zero-LTV assets (USDC guardrail) with `UserHasAssetWithZeroLtv()` error match.
- **TC9**: Asset-specific collateral addition calculations for WETH ($LT = 84\%$).
- **TC10**: Full position evaluation of verified borrower fixture (`0xcbc3301782507d85e57db83d7d19db2a82478570`).
- **TC11–TC15**: Alert generation on state transitions and recovery notifications.
- **TC16–TC17**: 10-minute alert deduplication window ($|\Delta HF| < 0.01$) and ledger filtering.
- **INT1–INT5**: Live Base Mainnet RPC block height, pool account introspection, oracle price feeds, and Pharos MCP search.

---

## Preset Verification Fixtures

| Preset | Address | Description | Expected Status |
| :--- | :--- | :--- | :--- |
| **Verified Borrower** | `0xcbc3301782507d85e57db83d7d19db2a82478570` | Active borrower on Base Aave V3 holding cbBTC & WETH collateral against USDC debt | Active Collateral: cbBTC, WETH<br>Active Debt: USDC<br>Health Factor: ~4.10<br>Risk: `HEALTHY` |
| **Zero-Debt Baseline** | `0x0000000000000000000000000000000000000001` | Inactive address with zero collateral and zero debt | Health Factor: $\infty$<br>Risk: `HEALTHY`<br>Actions: None required |

---

## Security Model & Non-Custodial Guarantees

1. **Zero Private Key Handling**: The application does not solicit, import, store, or transmit private keys, seed phrases, or keystores.
2. **Zero Transaction Execution**: The application issues only JSON-RPC read calls (`eth_call`, `eth_blockNumber`). No write transactions, gas expenditures, or wallet signing requests (`eth_sendTransaction`, `personal_sign`) are generated.
3. **No On-Chain Anchoring**: The system relies on local SHA-256 cryptographic logs and read-only protocol introspection rather than committing on-chain transactions, preserving a $0.00 operational cost.
4. **On-Chain Protocol Guardrail Proof**: Calling `setUserUseReserveAsCollateral` for USDC on Base reverts on-chain with `0x21e5c4ae` (`UserHasAssetWithZeroLtv()`). Liquidation Watchdog explicitly warns users that depositing USDC earns supply yield only and will NOT prevent liquidation.

---

## Monitoring Limitations & Active Browser Sentinel

- **Active Browser Sentinel**: The dashboard polls continuously in real-time while the web browser tab is open (selectable at 15s, 30s, or 60s intervals).
- **Tab Closure**: Polling automatically pauses when the browser tab is closed or suspended.
- **Serverless Scheduled Cron**: Vercel Hobby serverless scheduled cron operates at most once per 24 hours (`0 0 * * *`). Continuous background monitoring while the browser is closed is explicitly disclaimed.

---

## Environment Variables Configuration

Copy `.env.example` to `.env` to override default RPC endpoints:

| Variable | Description | Default |
| :--- | :--- | :--- |
| `BASE_RPC_URL` | Primary Base Mainnet JSON-RPC endpoint | `https://mainnet.base.org` |
| `BASE_RPC_FALLBACK_URL` | Fallback Base Mainnet JSON-RPC endpoint | `https://1rpc.io/base` |
| `PHAROS_RPC_URL` | Pharos Pacific Mainnet RPC | `https://rpc.pharos.xyz` |
| `PHAROS_CHAIN_MCP_URL` | Pharos Chain Model Context Protocol endpoint | `https://mcp.pharos.xyz/mcp` |
| `PHAROS_DOCS_MCP_URL` | Pharos Developer Documentation MCP endpoint | `https://docs.pharos.xyz/~gitbook/mcp` |
| `PORT` | Local standalone server port | `3000` |

---

## License

MIT License. Copyright (c) 2026 JimmyOgb.
