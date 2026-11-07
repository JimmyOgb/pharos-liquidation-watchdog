# Phase 2 — Protocol Discovery: Cross-Network Lending Markets

**Project:** Liquidation Watchdog  
**Workspace:** `C:\Users\NO GO NO\PharosBuild\skills\pharos-liquidation-watchdog`  
**Execution Phase:** Phase 2 Discovery and Architecture Validation  
**Date:** November 7, 2026

---

## 1. Executive Summary

During Phase 1, an exhaustive audit of Pharos Pacific Mainnet (`Chain ID 1672`) and Atlantic Testnet (`Chain ID 688689`) confirmed that no live, deployed lending pool with active user positions currently exists on Pharos. In accordance with user authorization for **Option 2: Cross-Network Watchdog Gateway**, this document investigates candidate lending protocols on external EVM networks (specifically **Aave V3 on Base** and **Morpho Blue on Base/Ethereum**) to identify the most robust, verifiable, and transparent protocol for live liquidation-risk monitoring.

---

## 2. Protocol Comparison Matrix

| Evaluation Dimension | Candidate A: Aave V3 on Base | Candidate B: Morpho Blue | Selection Decision |
|---|---|---|:---:|
| **Target Network** | Base Mainnet (`Chain ID 8453`) | Ethereum (`1`) / Base (`8453`) | **Aave V3 on Base** |
| **Active Liquidity & Borrows** | $400M+ TVL, thousands of active loans | High TVL, isolated per-market pools | **Aave V3 on Base** |
| **Position Introspection Interface** | Single consolidated call `getUserAccountData(address)` | Multi-call: `position(Id, address)` + `market(Id)` per market | **Aave V3 on Base** |
| **Health Factor Source** | Authoritative, protocol-calculated `uint256 healthFactor` (scaled $10^{18}$) | Manually calculated: $(Collateral \times LLTV) / Debt$ | **Aave V3 on Base** |
| **Total Collateral & Debt Units** | Aggregated in USD base currency ($10^8$ scale, $1.00 = 100,000,000$) | Per-token balances; requires custom oracle conversion | **Aave V3 on Base** |
| **Asset-Level Breakdown** | Inspectable via `aToken` and `variableDebtToken` balances | Inspectable via market-specific collateral and borrow shares | Both Supported |
| **Public RPC Availability** | Free, zero-rate-limit public RPC (`https://mainnet.base.org`) | Public RPC available | **Aave V3 on Base** |
| **Live Borrower Verification** | Verified live borrowers identified in real time | Requires matching specific 32-byte MarketIds | **Aave V3 on Base** |

### Selected Primary Protocol: Aave V3 on Base
Aave V3 on Base provides the most direct, verifiable, and standardized interface for real-time portfolio monitoring. It provides:
1. An authoritative on-chain `healthFactor` computed by the protocol's own risk contracts.
2. Direct read access to aggregated collateral USD and debt USD without relying on third-party API aggregators.
3. High transactional activity on Base with low-latency public RPC response times.

---

## 3. Aave V3 on Base: Verified Contract Deployment

All contracts have been verified on-chain via Base Mainnet (`8453`):

### Core Protocol Contracts
- **Network:** Base Mainnet (`Chain ID 8453`)
- **Public RPC:** `https://mainnet.base.org`
- **Block Explorer:** `https://basescan.org`
- **Aave V3 Pool Proxy:** `0xA238Dd80C259a72e81d7e4664a9801593F98d1c5`
  - Bytecode length: 3,868 bytes
  - Standard proxy delegating to Aave V3 Pool logic.
- **Aave V3 PoolAddressesProvider:** `0xe20fCBdBfFC4Dd138cE8b2E6FBb6CB49777ad64D`
  - Bytecode length: 13,846 bytes
- **Aave V3 ProtocolDataProvider:** `0x2d8A3C5677189723C4cB8873CfC9C8976FDF38Ac`
  - Bytecode length: 20,546 bytes

### Verified Active Reserves on Base Aave V3
The Pool contract exposes 15 initialized reserves via `getReservesList()` (`0xd1946dbc`):

| Asset Symbol | Underlying Token Address | aToken Address | Variable Debt Token Address | Decimals |
|---|---|---|---|:---:|
| **WETH** | `0x4200000000000000000000000000000000000006` | `0xd4a0e0b9149bcee3c920d2e00b5de09138fd8bb7` | `0x24e6e0795b3c7c71d965fcc4f371803d1c1dca1e` | 18 |
| **USDC** | `0x833589fcd6edb6e08f4c7c32d4f71b54bda02913` | `0x4e65fe4dba92790696d040ac24aa414708f5c0ab` | `0x59dca05b6c26dbd64b5381374aaac5cd05644c28` | 6 |
| **cbBTC** | `0xcbb7c0000ab88b473b1f5afd9ef808440eed33bf` | `0xbdb9300b7cde636d9cd4aff00f6f009ffbbc8ee6` | `0x05e08702028de6aad395dc6478b554a56920b9ad` | 8 |
| **cbETH** | `0x2ae3f1ec7f1f5012cfeab0185bfc7aa3cf0dec22` | `0x8a920272e5052adcfd1ba28d44ec6dbdf2d0e74b` | `0x59714856f7efb0dd6478d8a7cba8b1c4b791010d` | 18 |
| **wstETH** | `0xc1cba3fcea344f92d9239c08c0568f6f2f0ee452` | `0x04c0599ae5a44757c0af6f9ec3b93da8976c150a` | `0x4db4e0b57e7cb28387ea310d7054a3952ba57161` | 18 |

---

## 4. On-Chain Interface & Data Specifications

### Primary Read Method: `getUserAccountData`
- **Target:** Aave V3 Pool Proxy (`0xA238Dd80C259a72e81d7e4664a9801593F98d1c5`)
- **Function Selector:** `0xbf92857c` (`getUserAccountData(address)`)
- **Input Parameter:** 32-byte zero-padded EVM wallet address.
- **Output Return Tuple (6 words, 192 bytes):**
  1. `totalCollateralBase` (uint256): Total collateral value in base currency (USD, 8 decimals).
  2. `totalDebtBase` (uint256): Total borrow debt in base currency (USD, 8 decimals).
  3. `availableBorrowsBase` (uint256): Remaining borrowing capacity in USD (8 decimals).
  4. `currentLiquidationThreshold` (uint256): Position-weighted liquidation threshold in basis points (e.g., $8400 = 84.00\%$).
  5. `ltv` (uint256): Position-weighted loan-to-value in basis points (e.g., $8100 = 81.00\%$).
  6. `healthFactor` (uint256): Position health factor scaled by $10^{18}$ (WAD). If debt is 0, returns `type(uint256).max`.

### Secondary Read Methods: Asset-Level Balances
- **Collateral Balance:** `balanceOf(address user)` (`0x70a08231`) queried on the reserve's `aTokenAddress`.
- **Borrow Debt Balance:** `balanceOf(address user)` (`0x70a08231`) queried on the reserve's `variableDebtTokenAddress`.

---

## 5. Health Factor & Liquidation Mechanics

In Aave V3, liquidation eligibility is defined strictly by the health factor equation:

$$HF = \frac{\text{totalCollateralBase} \times \text{currentLiquidationThreshold}}{\text{totalDebtBase} \times 10{,}000}$$

Where:
- $\text{currentLiquidationThreshold}$ is in basis points ($10{,}000 = 100\%$).
- When $HF < 1.00$, the position is undercollateralized and eligible for immediate on-chain liquidation by liquidator bots.
- When $\text{totalDebtBase} == 0$, $HF = \infty$ (`0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff`).

---

## 6. Candidate B Evaluation: Morpho Blue

Morpho Blue is an immutable, isolated lending protocol deployed at `0xBBBBBbbC7A4888c258290270a48979781827fbCA` on Ethereum Mainnet. 
- While architecturally elegant, querying a user's positions in Morpho Blue requires knowing or iterating over specific 32-byte `MarketId` hashes (combinations of `loanToken`, `collateralToken`, `oracle`, `irm`, and `lltv`).
- Morpho Blue does not expose an aggregated account summary or protocol-level health factor across all markets.
- **Conclusion:** Aave V3 is chosen as the primary live protocol because it enables instant, single-query wallet lookups across all assets without requiring prior knowledge of specific market IDs.
