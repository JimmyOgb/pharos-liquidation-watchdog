# Phase 2 — Live Evidence Report: On-Chain Lending Positions

**Project:** Liquidation Watchdog  
**Workspace:** `C:\Users\NO GO NO\PharosBuild\skills\pharos-liquidation-watchdog`  
**Network Under Test:** Base Mainnet (`Chain ID 8453`)  
**Verified Base RPC:** `https://mainnet.base.org`  
**Observation Block Height:** `54404716`  
**Observation UTC Timestamp:** `2026-11-07T17:08:35.482Z`  
**Aave V3 Pool Proxy:** `0xA238Dd80C259a72e81d7e4664a9801593F98d1c5`  
**Aave Oracle (Base):** `0x2Cc0Fc26eD4563A5ce5e8bdcfe1A2878676Ae156`  

---

## 1. Verified Target Contracts & Provenance

| Contract Name | Verified On-Chain Address | Bytecode Size | Function Verified |
|---|---|:---:|---|
| **Aave V3 Pool Proxy** | `0xA238Dd80C259a72e81d7e4664a9801593F98d1c5` | 3,868 bytes | `getUserAccountData(address)` (`0xbf92857c`) |
| **Aave Oracle (Base)** | `0x2Cc0Fc26eD4563A5ce5e8bdcfe1A2878676Ae156` | 5,534 bytes | `getAssetPrice(address)` (`0xb3596f07`) |
| **cbBTC aToken** | `0xbdb9300b7cde636d9cd4aff00f6f009ffbbc8ee6` | 13,846 bytes | `balanceOf(address)` (`0x70a08231`) |
| **WETH aToken** | `0xd4a0e0b9149bcee3c920d2e00b5de09138fd8bb7` | 13,846 bytes | `balanceOf(address)` (`0x70a08231`) |
| **USDC aToken** | `0x4e65fe4dba92790696d040ac24aa414708f5c0ab` | 13,846 bytes | `balanceOf(address)` (`0x70a08231`) |
| **USDC Variable Debt Token**| `0x59dca05b6c26dbd64b5381374aaac5cd05644c28` | 13,846 bytes | `balanceOf(address)` (`0x70a08231`) |

---

## 2. Monitored Public Borrower Evidence

- **Target Public Wallet:** `0xcbc3301782507d85e57db83d7d19db2a82478570`
- **Method Invoked:** `getUserAccountData(address)` (`0xbf92857c`)
- **Block Height Anchor:** `54404716`
- **UTC Timestamp:** `2026-11-07T17:08:35.482Z`

### Complete Un-Ellipsized Raw Hexadecimal Output (192 bytes):
```hex
0x0000000000000000000000000000000000000000000000000000006e6e8053be000000000000000000000000000000000000000000000000000000169bafb5ba00000000000000000000000000000000000000000000000000000042d76b6f6200000000000000000000000000000000000000000000000000000000000020d00000000000000000000000000000000000000000000000000000000000001fa400000000000000000000000000000000000000000000000038f0fecdf8ed008b
```

### Word-by-Word Decoded On-Chain Position:
| Parameter | Raw Hex Word | Raw Decoded Integer | Normalized Human Value | Unit / Format |
|---|---|---|---|---|
| `totalCollateralBase` | `0x000...006e6e8053be` | `474300306366` | **$4,743.00306366 USD** | Base currency (8 decimals) |
| `totalDebtBase` | `0x000...00169bafb5ba` | `97101264314` | **$971.01264314 USD** | Base currency (8 decimals) |
| `availableBorrowsBase` | `0x000...0042d76b6f62` | `287081983842` | **$2,870.81983842 USD** | Base currency (8 decimals) |
| `currentLiquidationThreshold` | `0x000...0000000020d0` | `8400` | **84.00%** | Basis points ($10^4$) |
| `ltv` | `0x000...000000001fa4` | `8100` | **81.00%** | Basis points ($10^4$) |
| `healthFactor` | `0x000...38f0fecdf8ed008b`| `4103059421132554379` | **4.103059421132554379** | WAD ($10^{18}$) |

---

## 3. Independent Asset Reconciliation at Block 54404716

### A. Collateral Assets & Exact Arithmetic
1. **cbBTC (`0xcbb7...33bf`, 8 decimals):**
   - Raw aToken Balance: `6,226,986` ($0.06226986$ cbBTC)
   - Aave Oracle Price: `7571507000000` ($75,715.07000000 USD)
   - Raw Base Value: $(6226986 \times 7571507000000) / 10^8 = \mathbf{471476680879}$ ($4,714.76680879 USD)
2. **WETH (`0x4200...0006`, 18 decimals):**
   - Raw aToken Balance: `12,658,656,967,834,027` wei ($0.012658656967834027$ WETH)
   - Aave Oracle Price at Block 54404716: `223058851701` ($2,230.58851701 USD)
   - Raw Base Value: $(12658656967834027 \times 223058851701) / 10^{18} = \mathbf{2823625487}$ ($28.23625487 USD)
3. **USDC (`0x8335...2913`, 6 decimals):**
   - Raw aToken Balance: `800,001,639` ($800.001639$ USDC)
   - **Collateral Status:** **NOT enabled as collateral** by this user in `userConfiguration`. It earns lending APY but does not contribute to borrowing margin.

$$\text{Sum of Active Collaterals} = 471476680879 + 2823625487 = \mathbf{474300306366} \text{ base units}$$
$$\text{Protocol } \texttt{totalCollateralBase} = \mathbf{474300306366} \text{ base units}$$
$$\mathbf{Integer\ Variance = 0\ base\ units\ (0.00000000\ USD)}$$

---

### B. Borrowed Debt & Exact Arithmetic
1. **USDC Variable Debt (`0x59dc...4c28`, 6 decimals):**
   - Raw Debt Balance: `971,255,457` micro-USDC ($971.255457$ USDC)
   - Aave Oracle Price: `99,975,000` ($0.99975000 USD)
   - Raw Product: $971255457 \times 99975000 = 97101264313575000$ (Remainder: $575,000 / 10^6$)
   - In Aave V3 (`MathUtils.sol`), conversion to base currency adds half the divisor (`500,000`) for half-up rounding:
     $$\text{Calculated Base Debt} = \lfloor (97101264313575000 + 500000) / 10^6 \rfloor = \mathbf{97101264314}$$
   - Protocol Reported `totalDebtBase`: $\mathbf{97101264314}$ ($971.01264314 USD)
   - **Integer Variance:** $\mathbf{0}$ base units ($0.00000000 USD). Matches identically to the single wei. Both normalized values display as **`$971.01 USD`**.

---

## 4. Health Factor Recalculation

### Unrounded Integer Recalculation (Full Precision):
$$\text{Calculated HF} = \frac{474300306366 \times 8400 \times 10^{18}}{97101264314 \times 10{,}000} = \mathbf{4103059421132554379} \text{ WAD}$$
- Reported: `4103059421132554379`
- Calculated: `4103059421132554379`
- **Integer Variance in Wei: 0.**

### Display-Rounded Calculation:
$$\frac{4743.00 \times 0.84}{971.01} = 4.10306794$$
- The $0.00000852$ variance occurs strictly from truncating sub-cent decimals. The unrounded on-chain math is identical to the single wei.
