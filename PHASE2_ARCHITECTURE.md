# Phase 2 — System Architecture: Cross-Network Watchdog Gateway

**Project:** Liquidation Watchdog  
**Workspace:** `C:\Users\NO GO NO\PharosBuild\skills\pharos-liquidation-watchdog`  
**Execution Phase:** Phase 2.1.1 Architecture & Reconciliation Validation  

---

## 1. Architectural Overview & Boundaries

The **Liquidation Watchdog** operates as an **Agent-Native Cross-Network Gateway**. It bridges verified lending positions from high-liquidity EVM markets (Aave V3 on Base) with the autonomous intelligence, security policies, and documentation tooling of the **Pharos AI Ecosystem**.

```
+----------------------------------------------------------------------------------------------------+
|                                      LIQUIDATION WATCHDOG GATEWAY                                  |
+----------------------------------------------------------------------------------------------------+
|                                                                                                    |
|  [ Client Browser UI ] <-----------------------------------------> [ Pharos Agent Orchestrator ]   |
|        |                                                                     |                     |
|        | 1. Query Address                                                    | 3. Cross-Reference  |
|        v                                                                     v                     |
|  [ Public Base RPC ] (Chain ID 8453)                              [ Pharos AI Tooling ]            |
|        |                                                                     |                     |
|        | eth_call (Aave V3 Pool & Oracle)                                    +-- Pharos Docs MCP   |
|        v                                                                     +-- Pharos Skill Eng  |
|  [ Live Collateral, Debt, HF, Decimals ]                                     +-- Pharos Chain MCP  |
|        |                                                                     |                     |
|        +-----------------------------------> [ Deterministic Risk Engine ] <-+ (Local SHA-256)    |
|                                                              |                                     |
|                                             4. Generate Timestamped Alerts &                       |
|                                                Exact Repayment & Asset-Specific                    |
|                                                Collateral Recommendations                          |
+----------------------------------------------------------------------------------------------------+
```

### Strict Architectural Boundaries
1. **External EVM Data Ingestion:** Lending state is queried directly from the verified Aave V3 Pool (`0xA238Dd80C259a72e81d7e4664a9801593F98d1c5`) and Aave Oracle (`0x2Cc0Fc26eD4563A5ce5e8bdcfe1A2878676Ae156`) on Base (`8453`). It is **never** falsely attributed to Pharos Chain MCP.
2. **Local Evidence Provenance:** Tool inputs, raw RPC hex payloads, and decoded position structs are cryptographically hashed using **SHA-256** in a local provenance registry. **No on-chain transactions, gas spend, or on-chain anchoring is executed.**
3. **Deterministic Authority:** Health factors, risk states, and recommended action quantities are calculated purely by deterministic TypeScript code. The LLM provides narrative context and explanations, but cannot modify numerical calculations.

---

## 2. On-Chain Reserve Configuration & Account Enablement

From on-chain inspection of `ReserveConfigurationMap` on Base Aave V3:

| Asset | Decimals | LTV | Liquidation Threshold ($LT_{\text{asset}}$) | Liquidation Bonus | Reserve Status |
|---|:---:|:---:|:---:|:---:|:---:|
| **cbBTC** | 8 | 81.00% | **84.00%** (`8400`) | 106.00% | Active, Borrowable, Collateral Eligible |
| **WETH** | 18 | 81.00% | **84.00%** (`8400`) | 105.00% | Active, Borrowable, Collateral Eligible |
| **USDC** | 6 | **0.00%** | **78.00%** (`7800`) | 105.00% | Active, Borrowable, Collateral Eligible (0% LTV) |

### Account-Level Collateral Rule
In Aave V3, supplying an asset does not make it collateral automatically unless the user enables it via `setUserUseReserveAsCollateral(asset, true)`. The Watchdog distinguishes:
- **Active Collateral:** Assets with account enablement that protect the position.
- **Yield-Only Deposits:** Assets deposited but not enabled as collateral (e.g. the 800 USDC deposited by `0xcbc3...8570`).

---

## 3. Mathematical Rigor: Action Recommendations

When a position triggers a `WARNING`, `CRITICAL`, or `LIQUIDATION RISK` state, the engine calculates concrete corrective actions to restore the health factor to a configurable **Safety Target** ($HF_{\text{target}}$, default `1.50`).

### A. Repayment Recommendation (Debt Reduction)
Given current total collateral $C$ in USD, total debt $D$ in USD, and current weighted liquidation threshold $LT$:

$$HF_{\text{target}} = \frac{C \times LT}{D - \Delta D_{\text{USD}}}$$

Solving for required USD debt repayment $\Delta D_{\text{USD}}$:

$$\Delta D_{\text{USD}} = \max\left(0, D - \frac{C \times LT}{HF_{\text{target}}}\right)$$

To convert $\Delta D_{\text{USD}}$ into exact units of the borrowed asset (e.g. USDC, with price $P_{\text{debt}}$ from Aave Oracle and decimals $d_{\text{debt}}$):

$$\Delta D_{\text{tokens}} = \frac{\Delta D_{\text{USD}}}{P_{\text{debt}}}$$
$$\Delta D_{\text{raw}} = \lfloor \Delta D_{\text{tokens}} \times 10^{d_{\text{debt}}} \rfloor \quad \text{(Floor rounding prevents over-repayment)}$$

---

### B. Corrected Collateral Addition (Asset-Specific Liquidation Threshold)
When adding collateral of a specific supported asset $A$ (e.g., cbBTC, WETH, or USDC), the new collateral contributes according to **its own liquidation threshold** $LT_{\text{asset}}$, not the existing position's historical average:

$$HF_{\text{target}} = \frac{(C \times LT) + (\Delta C_{\text{USD}} \times LT_{\text{asset}})}{D}$$

Solving for required USD collateral addition $\Delta C_{\text{USD}}$:

$$\Delta C_{\text{USD}} = \max\left(0, \frac{(D \times HF_{\text{target}}) - (C \times LT)}{LT_{\text{asset}}}\right)$$

In units of the deposited collateral token (with price $P_{\text{col}}$ and decimals $d_{\text{col}}$):

$$\Delta C_{\text{tokens}} = \frac{\Delta C_{\text{USD}}}{P_{\text{col}}}$$
$$\Delta C_{\text{raw}} = \lceil \Delta C_{\text{tokens}} \times 10^{d_{\text{col}}} \rceil \quad \text{(Ceiling rounding ensures safety target is achieved)}$$

### Deterministic Test Matrix
| Test Case | Collateral $C$ | Debt $D$ | Current $LT$ | Target $HF$ | Asset $LT_{\text{asset}}$ | Asset Price | Recommended Repayment | Recommended Collateral Addition |
|---|---|---|---|---|---|---|---|---|
| **TC1: Warning State ($HF = 1.20$) with WETH** | $4,743.00 | $3,316.00 | 84.00% | 1.50 | 84.00% (WETH, LTV 81%) | $2,230.58 | **$659.92** (660.08 USDC) | **$1,178.43** (0.528306 WETH) |
| **TC2: Warning State with cbBTC** | $4,743.00 | $3,316.00 | 84.00% | 1.50 | 84.00% (cbBTC, LTV 81%) | $75,715.07 | **$659.92** (660.08 USDC) | **$1,178.43** (0.015564 cbBTC) |
| **TC3: Zero-LTV Asset Rejection (USDC)** | $4,743.00 | $3,316.00 | 84.00% | 1.50 | 78.00% (USDC, LTV 0%) | $0.99975 | **$659.92** (660.08 USDC) | **REJECTED** (Zero-LTV asset cannot be enabled as collateral) |
| **TC4: Zero Debt Edge Case** | $5,000.00 | $0.00 | 84.00% | 1.50 | 84.00% | $2,230.58 | **$0.00** | **$0.00** |
| **TC5: Already Healthy ($HF = 4.10$)**| $4,743.00 | $971.01 | 84.00% | 1.50 | 84.00% | $2,230.58 | **$0.00** | **$0.00** |
| **TC6: Uncollateralized Debt ($C = 0$)**| $0.00 | $1,000.00 | 84.00% | 1.50 | 84.00% | $2,230.58 | **$1,000.00** (Full Repay) | **$1,785.71** (WETH) |

> [!IMPORTANT]
> **Collateral Eligibility Guardrail:** The recommendation engine strictly checks `LTV > 0` before computing a collateral addition recommendation. Assets like USDC (which carry an LTV of 0% on Base Aave V3) trigger custom error `0x21e5c4ae` (`UserHasAssetWithZeroLtv()`) when attempting to enable collateral on-chain. Therefore, USDC is strictly excluded from collateral addition advice.
> 
> All recommendations are clearly labeled in the user interface as **Estimates** to account for real-time accrued interest, price oracle updates, and token transfer fees.

---

## 4. Monitoring Architecture & Vercel Scheduling

### Vercel Hobby Limitations
According to official Vercel documentation:
- **Vercel Hobby Cron:** Maximum frequency is **once per day** (`0 0 * * *`). Sub-daily cron jobs (e.g., hourly or every minute) are restricted to Vercel Pro.
- **Serverless Lifespan:** Serverless functions are ephemeral (10s max duration on Hobby) and terminate once the HTTP response finishes. Continuous background threads do not run when the application is idle.

### Honest Monitoring Design
1. **Active Browser Sentinel (High Frequency):**
   - Operates while the dashboard is open in an active browser tab.
   - Polling frequency is user-configurable (15s / 30s / 60s).
   - Displays a live "Pulsing Heartbeat" badge with a countdown timer to the next observation.
   - Fires instant notifications and appends to the Alert Ledger when thresholds cross.
2. **On-Demand Immediate Refresh:**
   - Dedicated `Refresh Position` button allows users to force an instant on-chain query.
3. **Stale-Data Handling:**
   - If no fresh on-chain data has been received within **120 seconds** (e.g., browser tab suspended, network loss, or RPC timeout), the UI displays an amber `STALE DATA` warning and flags the position as unconfirmed.
4. **RPC Failure Fallback:**
   - Queries cycle between `https://mainnet.base.org` and `https://1rpc.io/base`.
   - If both fail, the position enters the `DATA UNAVAILABLE` fail-closed state.
5. **Daily Vercel Cron Snapshot:**
   - A once-per-day baseline check (`api/cron.js`) records a health check snapshot without violating Vercel Hobby restrictions.
