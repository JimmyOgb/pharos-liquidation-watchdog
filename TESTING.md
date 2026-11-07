# Testing & Verification Guide

## 1. Test Architecture Overview

The Liquidation Watchdog test suite comprises **22 automated tests**:
- **17 Deterministic Unit Tests** (`tests/unit/*.test.ts`): Testing risk classification thresholds, debt repayment math, asset-specific collateral addition, zero-LTV guardrail invariants, alert transitions, and deduplication windows.
- **5 Live On-Chain Integration Tests** (`tests/integration/*.test.ts`): Querying live Base Mainnet RPC (`8453`), the verified Aave V3 Pool, Aave Oracle feeds, zero-debt baseline fixture, and Pharos Docs MCP.

---

## 2. Running Tests

### Complete Test Suite
```bash
npm test
```

### Unit Tests Only
```bash
npm run test:unit
```

### Integration Tests Only
```bash
npm run test:integration
```

### Static Typechecking
```bash
npm run typecheck
```

---

## 3. Test Cases Specification

### Unit Test Suite: `tests/unit/riskEvaluator.test.ts`
- **TC1**: No active debt classified as `HEALTHY` regardless of raw health factor ($HF = 0$ or $HF = \infty$).
- **TC2**: $HF \le 1.00$ classified as `LIQUIDATION RISK`.
- **TC3**: $HF \le 1.10$ (critical threshold) classified as `CRITICAL`.
- **TC4**: $HF \le 1.30$ (warning threshold) classified as `WARNING`.
- **TC5**: $HF > 1.30$ classified as `HEALTHY`.
- **TC6**: Mathematical precision of debt repayment required to restore Health Factor to safety target (1.50).
- **TC7**: Returns 0 repayment if position already satisfies target Health Factor.
- **TC8**: Rejection of USDC collateral addition recommendation due to 0% LTV invariant (`isEligible: false`, `UserHasAssetWithZeroLtv()` error match).
- **TC9**: Asset-specific collateral addition for WETH with 84% liquidation threshold and ceiling integer token units.
- **TC10**: Full position evaluation of verified borrower fixture (`0xcbc3301782507d85e57db83d7d19db2a82478570`).

### Unit Test Suite: `tests/unit/alertSystem.test.ts`
- **TC11**: Initial healthy position emits no alert.
- **TC12**: State transition from `HEALTHY` to `WARNING` emits `WARNING` alert.
- **TC13**: State transition from `WARNING` to `CRITICAL` emits `CRITICAL` alert.
- **TC14**: State transition to `LIQUIDATION RISK` ($HF \le 1.0$) emits `CRITICAL` alert.
- **TC15**: State transition from `CRITICAL` back to `HEALTHY` emits `RECOVERY` alert.
- **TC16**: Deduplication window suppresses alerts when state is unchanged and $|\Delta HF| < 0.01$ within 10 minutes.
- **TC17**: Per-wallet alert ledger filtering and query isolation.

### Integration Test Suite: `tests/integration/aaveV3Live.test.ts`
- **INT1**: Retrieves live block number from Base Mainnet RPC ($> 54,000,000$).
- **INT2**: Reads verified borrower account data from Aave V3 Pool (`0xA238...d1c5`) with positive collateral and debt.
- **INT3**: Reads empty baseline wallet (`0x000...0001`) returning zero collateral and zero debt.
- **INT4**: Introspects verified asset prices from Base AaveOracle (`0x2Cc0...e156`) for WETH ($> \$1,000$), cbBTC ($> \$30,000$), and USDC ($\approx \$1.00$).
- **INT5**: Queries Pharos Docs MCP with SHA-256 provenance logging.

---

## 4. Reproducible Test Run Output

```text
▶ AaveV3BaseClient - Live On-Chain Integration (Chain ID 8453)
  ✔ INT1: Retrieves current Base block number from live RPC (1091.4ms)
  ✔ INT2: Reads verified borrower position from Aave V3 Pool (1353.6ms)
  ✔ INT3: Reads empty baseline wallet returning zero collateral and zero debt (363.3ms)
  ✔ INT4: Introspects verified asset prices from Base AaveOracle (666.1ms)
  ✔ INT5: Queries Pharos Docs MCP with provenance logging (2318.0ms)
✔ AaveV3BaseClient - Live On-Chain Integration (Chain ID 8453) (5796.0ms)
▶ AlertSystem - Threshold Crossings & State Transitions
  ✔ TC11: Initial healthy position emits no alert (14.5ms)
  ✔ TC12: Transition from HEALTHY to WARNING emits WARNING alert (1.6ms)
  ✔ TC13: Transition from WARNING to CRITICAL emits CRITICAL alert (0.9ms)
  ✔ TC14: Transition to LIQUIDATION RISK (HF <= 1.0) emits CRITICAL alert (3.5ms)
  ✔ TC15: Recovery transition from CRITICAL back to HEALTHY emits RECOVERY alert (1.4ms)
✔ AlertSystem - Threshold Crossings & State Transitions (28.0ms)
▶ AlertSystem - Deduplication Window
  ✔ TC16: Deduplicates consecutive polls when state unchanged and |ΔHF| < 0.01 (1.5ms)
  ✔ TC17: Per-wallet alert ledger filtering works correctly (1.5ms)
✔ AlertSystem - Deduplication Window (4.2ms)
▶ RiskEvaluator - Threshold Classification
  ✔ TC1: No active debt is classified as HEALTHY regardless of HF value (2.9ms)
  ✔ TC2: HF <= 1.0 is classified as LIQUIDATION RISK (0.6ms)
  ✔ TC3: HF <= criticalThreshold (1.10) is classified as CRITICAL (0.8ms)
  ✔ TC4: HF <= warningThreshold (1.30) is classified as WARNING (0.4ms)
  ✔ TC5: HF > warningThreshold is classified as HEALTHY (0.4ms)
✔ RiskEvaluator - Threshold Classification (10.8ms)
▶ RiskEvaluator - Debt Repayment Recommendations
  ✔ TC6: Calculates debt repayment required to restore HF to target (1.1ms)
  ✔ TC7: Returns 0 repayment if position already satisfies target HF (0.8ms)
✔ RiskEvaluator - Debt Repayment Recommendations (2.6ms)
▶ RiskEvaluator - Collateral Addition & Zero-LTV Guardrails
  ✔ TC8: Rejects USDC collateral recommendation due to 0% LTV invariant (1.3ms)
  ✔ TC9: Calculates asset-specific collateral addition for WETH (LT = 84%) (7.2ms)
✔ RiskEvaluator - Collateral Addition & Zero-LTV Guardrails (9.2ms)
▶ RiskEvaluator - Full Position Evaluation
  ✔ TC10: Evaluates verified live borrower fixture correctly (3.7ms)
✔ RiskEvaluator - Full Position Evaluation (3.9ms)
ℹ tests 22
ℹ suites 7
ℹ pass 22
ℹ fail 0
```
