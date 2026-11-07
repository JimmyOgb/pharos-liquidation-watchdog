# Security Policy & Invariant Audits

## 1. Non-Custodial & Read-Only Invariant

Liquidation Watchdog adheres to strict non-custodial boundaries:

1. **Zero Private Key Handling**: The application does not solicit, import, store, or transmit private keys, seed phrases, or keystores.
2. **Zero Transaction Execution**: The application issues only JSON-RPC read calls (`eth_call`, `eth_blockNumber`). No write transactions, gas expenditures, or wallet signing requests (`eth_sendTransaction`, `personal_sign`) are generated.
3. **No On-Chain Anchoring**: The system relies on local SHA-256 cryptographic logs and read-only protocol introspection rather than committing on-chain transactions, preserving a $0.00 operational cost.

---

## 2. On-Chain Protocol Guardrail: Zero-LTV USDC Invariant

A critical vulnerability in naive lending bots is recommending users "deposit stablecoins as collateral" during market downturns.

On **Base Aave V3**, USDC has been governance-configured with **0% Loan-to-Value (LTV)**:

```solidity
// Aave V3 ValidationLogic.sol
if (vars.collateralReserveLTV == 0) {
    revert Errors.UserHasAssetWithZeroLtv(); // Error code: 0x21e5c4ae
}
```

### Empirical On-Chain Verification
- **Simulated Call**: `setUserUseReserveAsCollateral(USDC, true)` on Pool `0xA238Dd80C259a72e81d7e4664a9801593F98d1c5`.
- **Result**: Reverted with `0x21e5c4ae` (`UserHasAssetWithZeroLtv()`).
- **Watchdog Engine Enforcement**:
  - The Risk Evaluator marks USDC deposits as `Yield-Only Deposit`.
  - USDC collateral addition recommendations are flagged `isEligible: false`.
  - A clear warning instructs the user that depositing USDC earns supply yield only and will NOT prevent liquidation.

---

## 3. Threat Model & Mitigation Strategy

| Threat | Impact | Mitigation in Liquidation Watchdog |
| :--- | :--- | :--- |
| **RPC Node Failure / Outage** | Inability to inspect position | Automatic failover from `https://mainnet.base.org` to `https://1rpc.io/base`. If all fail, displays `DISCONNECTED` badge and retries on next poll. |
| **Flash Loan / Price Oracle Manipulation** | False liquidation alerts | Prices are verified directly through `AaveOracle` (`0x2Cc0Fc26eD4563A5ce5e8bdcfe1A2878676Ae156`), which incorporates Chainlink decentralized feeds. |
| **Tampered / Stale Data** | User acts on outdated health factor | Observation block height and UTC timestamps are attached to all reports. Any data older than 120s triggers `STALE (>120s)` indicator. |
| **Alert Fatigue from Market Noise** | Excessive notifications | State-based alerting with 10-minute deduplication for $|\Delta HF| < 0.01$. |
| **Input Injection / Malformed Address** | Application crash / SSRF | Strict regex validation (`^0x[a-fA-F0-9]{40}$`) on all wallet inputs prior to RPC dispatch. |

---

## 4. Cryptographic Provenance Integrity

Every RPC query, oracle read, and Pharos MCP call is hashed via SHA-256:

```typescript
const digest = createHash('sha256').update(rawPayload).digest('hex');
```

These hashes are exposed in the collapsible UI audit drawer, allowing operators to verify that position metrics match raw on-chain state identically.
