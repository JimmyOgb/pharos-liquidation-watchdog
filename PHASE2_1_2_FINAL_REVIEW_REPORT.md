# Phase 2.1.2 — Final Debt Rounding & Collateral Eligibility Review Report

**Project:** Liquidation Watchdog  
**Workspace:** `C:\Users\NO GO NO\PharosBuild\skills\pharos-liquidation-watchdog`  
**Execution Phase:** Phase 2.1.2 Verification & Review  
**Date:** November 7, 2026  
**Status:** **Definitive On-Chain Resolution Established — Awaiting Authorization for Phase 3**

---

## 1. Executive Summary

This report establishes the exact mathematical and on-chain causes for:
1. The **one-base-unit debt discrepancy** identified in Phase 2.1.1, reproducing Aave's exact half-up base currency integer division.
2. The **USDC collateral-eligibility rule**, proving via read-only simulation that enabling USDC as collateral reverts on-chain with `UserHasAssetWithZeroLtv()` (`0x21e5c4ae`).
3. A corrected, fail-safe **Recommendation Engine Specification** that prevents recommending non-collateralizable zero-LTV assets.

---

## 2. Item 1: Tracing the One-Base-Unit Debt Difference

### The Reported Issue
At Base block `54404716`:
- Raw Variable Debt Balance (`balanceOf` on `0x59dc...4c28`): `971,255,457` micro-USDC ($971.255457$ USDC)
- Raw Oracle Price (`0x2Cc0...e156`): `99,975,000` ($0.99975000 USD)
- Naive Floor Division:
  $$\lfloor (971255457 \times 99975000) / 10^6 \rfloor = \mathbf{97101264313}$$
- Protocol Reported `totalDebtBase`: $\mathbf{97101264314}$ (a 1-unit difference of $0.00000001 USD).

---

### On-Chain Mathematical Trace
In Aave V3, the conversion from asset units to base currency USD in contract math (`MathUtils.sol` and `GenericLogic.sol`) applies **half-up integer rounding** (`+ halfDivisor`) rather than naive truncation:

$$\text{Product} = 971255457 \times 99975000 = \mathbf{97101264313575000}$$

When dividing by $10^{\text{decimals}} = 10^6 = 1{,}000{,}000$:
$$\text{Remainder} = 575000$$
Because the remainder ($575{,}000$) is greater than half of the divisor ($500{,}000$), standard half-up integer division adds `500,000` before dividing:

$$\text{Aave Rounded Base Debt} = \left\lfloor \frac{97101264313575000 + 500000}{1000000} \right\rfloor = \mathbf{97101264314}$$

| Accounting Formula | Integer Base Units | USD Value | Variance to Protocol |
|---|---|---|:---:|
| **Naive Floor Division** | `97101264313` | `$971.01264313` | $-1$ unit |
| **Aave Half-Up Integer Division** | `97101264314` | `$971.01264314` | **0 units (Exact Match)** |
| **Protocol Reported `totalDebtBase`** | `97101264314` | `$971.01264314` | **0 units (Exact Match)** |

**Conclusion:** The one-base-unit difference is completely resolved. It is caused by Aave's half-up rounding rule (`+ 500,000 / 1,000,000`) on fractional base units, which was omitted in naive floor division.

---

## 3. Item 2: USDC Collateral Eligibility Audit

### On-Chain Reserve Configuration (Word 0 of `getReserveData`)
We decoded the `ReserveConfigurationMap` for USDC (`0x833589fcd6edb6e08f4c7c32d4f71b54bda02913`) on the Aave V3 Pool Proxy (`0xA238Dd80C259a72e81d7e4664a9801593F98d1c5`):
- **Decimals:** 6
- **LTV (bits 0-15):** **`0.00%`** (`0`)
- **Liquidation Threshold (bits 16-31):** **`78.00%`** (`7800`)
- **Liquidation Bonus (bits 32-47):** `105.00%` (`10500`)
- **Active:** `true`
- **Frozen:** `false`
- **Borrowing Enabled:** `true`
- **Paused:** `false`

---

### Read-Only Simulation of `setUserUseReserveAsCollateral`
We simulated calling `setUserUseReserveAsCollateral(address asset, bool useAsCollateral)` (`0x5a3b74b9`) with `from: 0xcbc3301782507d85e57db83d7d19db2a82478570` via `eth_call`:

| Target Asset | Calldata | Simulation Result | Return / Revert Reason |
|---|---|:---:|---|
| **USDC** (`0x8335...2913`) | `0x5a3b74b9...0001` | **REVERT** | **`0x21e5c4ae` (`UserHasAssetWithZeroLtv()`)** |
| **WETH** (`0x4200...0006`) | `0x5a3b74b9...0001` | **SUCCESS** | `0x` (Valid Execution) |
| **cbBTC** (`0xcbb7...33bf`)| `0x5a3b74b9...0001` | **SUCCESS** | `0x` (Valid Execution) |

### Protocol Validation Logic (`ValidationLogic.sol`)
In Aave V3, `validateSetUseReserveAsCollateral` enforces:
```solidity
if (reserveConfig.getLtv() == 0) {
    revert Errors.UserHasAssetWithZeroLtv(); // Custom error selector: 0x21e5c4ae
}
```
Because Aave governance configured USDC with **`LTV = 0%`** on Base:
1. Calling `setUserUseReserveAsCollateral(USDC, true)` **reverts unconditionally**.
2. A user **cannot enable USDC as collateral** on Base Aave V3.
3. Supplying USDC earns lending yield, but **cannot contribute to `totalCollateralBase` or protect the health factor**.

---

## 4. Item 3: Corrected Recommendation Engine Specification

To ensure total accuracy, the recommendation engine implements a strict 4-tier collateral taxonomy:

```
+----------------------------------------------------------------------------------------------------+
|                                      COLLATERAL ASSET TAXONOMY                                     |
+----------------------------------------------------------------------------------------------------+
| 1. RESERVE-ELIGIBLE COLLATERAL (LTV > 0 & LT > 0)                                                  |
|    - Assets: WETH (LTV 81%, LT 84%), cbBTC (LTV 81%, LT 84%), cbETH, wstETH                       |
|    - Status: Can be enabled as collateral; eligible for Collateral Addition recommendations.      |
|                                                                                                    |
| 2. ZERO-LTV / INELIGIBLE ASSETS (LTV == 0)                                                         |
|    - Asset: USDC (LTV 0%, LT 78%)                                                                  |
|    - Status: Cannot be enabled as collateral (reverts with 0x21e5c4ae).                            |
|    - Engine Rule: STRICTLY REJECTED from Collateral Addition recommendations.                     |
|                                                                                                    |
| 3. ACCOUNT-LEVEL ACTIVE COLLATERAL (userConfig bitmap = 1)                                         |
|    - Monitored User: cbBTC ($4,714.77) + WETH ($28.26) = $4,743.00 Active Collateral.             |
|                                                                                                    |
| 4. YIELD-ONLY DEPOSITS (userConfig bitmap = 0)                                                     |
|    - Monitored User: 800 USDC ($799.80) earning APY, but $0.00 borrowing margin.                   |
+----------------------------------------------------------------------------------------------------+
```

### Recommendation Engine Rules:
1. **Collateral Addition Calculation:** The engine will **only** compute collateral addition recommendations using verified **Category 1** assets ($LTV > 0$, e.g., WETH or cbBTC).
2. **USDC Exclusion:** The engine will **never** suggest adding USDC to resolve liquidation risk, because USDC cannot be enabled as collateral.
3. **Debt Repayment Priority:** For USDC debt, the primary and most direct protective action is **Debt Repayment** (e.g. repaying USDC directly to reduce debt and instantly raise health factor).

---

## 5. Summary of Completed Deliverables

All Phase 2 reports have been reconciled and verified against on-chain bytecode:
1. [`PHASE2_1_2_FINAL_REVIEW_REPORT.md`](file:///C:/Users/NO%20GO%20NO/PharosBuild/skills/pharos-liquidation-watchdog/PHASE2_1_2_FINAL_REVIEW_REPORT.md) — This document.
2. [`PHASE2_1_1_RECONCILIATION_REPORT.md`](file:///C:/Users/NO%20GO%20NO/PharosBuild/skills/pharos-liquidation-watchdog/PHASE2_1_1_RECONCILIATION_REPORT.md) — Detailed reconciliation of all three discrepancies.
3. [`PHASE2_LIVE_EVIDENCE.md`](file:///C:/Users/NO%20GO%20NO/PharosBuild/skills/pharos-liquidation-watchdog/PHASE2_LIVE_EVIDENCE.md) — Un-ellipsized 192-byte hex payload, half-up rounding, and asset accounting.
4. [`PHASE2_ARCHITECTURE.md`](file:///C:/Users/NO%20GO%20NO/PharosBuild/skills/pharos-liquidation-watchdog/PHASE2_ARCHITECTURE.md) — Revalidated formulas, $LT_{\text{asset}}$ sensitivity, and collateral taxonomy.
5. [`PHASE2_IMPLEMENTATION_PLAN.md`](file:///C:/Users/NO%20GO%20NO/PharosBuild/skills/pharos-liquidation-watchdog/PHASE2_IMPLEMENTATION_PLAN.md) — Implementation milestones with explicit unit tests for Zero-LTV rejection.

---

## 6. Strict Stop Condition Status

All verification and review tasks are finalized. In accordance with strict boundaries:
- Zero application code has been written.
- No Git repository has been created.
- No Vercel deployment has been initiated.
- No transactions or state changes have been submitted.

**Execution has halted. Awaiting your review and explicit authorization for Phase 3.**
