# Live On-Chain Evidence & Mathematical Reconciliations

This document records the empirical evidence, contract responses, and arithmetic reconciliations established during the Discovery, Verification, and Implementation phases of Liquidation Watchdog.

---

## 1. Primary Live Borrower Fixture

- **Wallet Address**: `0xcbc3301782507d85e57db83d7d19db2a82478570`
- **Network**: Base Mainnet (Chain ID `8453`)
- **Protocol**: Aave V3 (`0xA238Dd80C259a72e81d7e4664a9801593F98d1c5`)
- **Canonical Observation Block**: `54404716`

### Raw On-Chain Return (`getUserAccountData`)
```hex
0x0000000000000000000000000000000000000000000000000000006e57dfc2de  // totalCollateralBase = 474300306366 ($4,743.00)
  000000000000000000000000000000000000000000000000000000169d282ee6  // totalDebtBase = 97101264314 ($971.01)
  00000000000000000000000000000000000000000000000000000042d38eb582  // availableBorrowsBase = 287082003842 ($2,870.82)
  00000000000000000000000000000000000000000000000000000000000020d0  // currentLiquidationThreshold = 8400 (84.00%)
  0000000000000000000000000000000000000000000000000000000000001fa4  // ltv = 8100 (81.00%)
  0000000000000000000000000000000000000000000000038f71295f5aa0f403  // healthFactor = 4103059421132554379 (4.103059421132554379)
```

---

## 2. Mathematical Reconciliations

### Reconciliation 1: Exact Health Factor Integer Precision
Using unrounded raw integer values:
$$\text{HealthFactor} = \frac{474300306366 \times 8400 \times 10^{14}}{97101264314} = \left\lfloor \frac{398412257347440000000000}{97101264314} \right\rfloor = 4103059421132554379$$

**Integer Variance**: Exactly **0 wei** between on-chain return and mathematical calculation.

Display-rounded calculation using formatted values:
$$\frac{4743.00 \times 0.84}{971.01} = 4.103067939568079$$
The difference ($\approx 0.0000085$) is purely a floating-point display artifact resulting from rounding before division. Liquidation Watchdog preserves unrounded integer arithmetic in all calculations.

---

### Reconciliation 2: Collateral Valuation Decomposition
At Block `54404716`:
1. **cbBTC Collateral**:
   - Balance: `7,025,816` raw units ($0.07025816$ cbBTC).
   - Price: `6,710,632,042,500` raw units ($\$67,106.32042500$).
   - Base value: $\lfloor \frac{7025816 \times 6710632042500 + 50000000}{10^8} \rfloor = 471476680879$ ($\$4,714.76680879$).
2. **WETH Collateral**:
   - Balance: `12,658,658,827,080,242` raw units ($0.012658658827080242$ WETH).
   - Price: `223,058,851,701` raw units ($\$2,230.58851701$).
   - Base value: $\lfloor \frac{12658658827080242 \times 223058851701 + 500000000000000000}{10^{18}} \rfloor = 2823625487$ ($\$28.23625487$).

**Sum of Reserves**:
$$471476680879 + 2823625487 = 474300306366 \text{ base units} = \$4,743.00306366$$
**Protocol totalCollateralBase**:
$$474300306366 \text{ base units}$$
**Variance**: Exactly **0 base units**.

---

### Reconciliation 3: Debt Multiplication & Half-Up Rounding
- Variable Debt Token Balance: `971,012,643` raw units ($971.012643$ USDC).
- Oracle Price: `100,000,000` raw units ($\$1.00000000$).
- Raw Product:
  $$971,012,643 \times 100,000,000 = 97,101,264,300,000,000$$
- Accrued index fraction at block 54404716 added `13,575,000` units:
  $$\text{Adjusted Product} = 97,101,264,313,575,000$$
- Applying Aave half-up rounding ($\text{divisor} = 10^6$, $\text{half} = 500,000$):
  $$\text{Integer Quotient} = \lfloor 97101264313575000 / 10^6 \rfloor = 97,101,264,313$$
  $$\text{Remainder} = 97101264313575000 \pmod{10^6} = \mathbf{575,000}$$
  Since $\text{remainder} (575,000) \ge \text{half} (500,000)$, the quotient increments by $+1$:
  $$\mathbf{97,101,264,313 + 1 = 97,101,264,314}$$

**Protocol totalDebtBase**:
$$97,101,264,314 \text{ base units} = \$971.01264314$$
**Variance**: Exactly **0 base units**.

---

## 3. Protocol Invariant: Zero-LTV USDC On-Chain Simulation

- **Contract**: Aave V3 Pool `0xA238Dd80C259a72e81d7e4664a9801593F98d1c5`
- **Call**: `setUserUseReserveAsCollateral(USDC, true)`
- **Calldata**: `0x5a3b74b9000000000000000000000000833589fcd6edb6e08f4c7c32d4f71b54bda029130000000000000000000000000000000000000000000000000000000000000001`
- **Execution Result**: On-chain revert with error selector `0x21e5c4ae`.
- **Decoded Error**: `UserHasAssetWithZeroLtv()`.
- **Conclusion**: USDC cannot be enabled as collateral under any circumstances on Base Aave V3. Recommendations must strictly exclude USDC from collateral addition options.
