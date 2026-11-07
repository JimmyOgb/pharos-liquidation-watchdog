/**
 * Liquidation Watchdog - Configuration & Verified Contract Constants
 */

import type { ReserveAssetConfig } from '../types/index.ts';

export const CONFIG = {
  BASE: {
    CHAIN_ID: 8453,
    CHAIN_NAME: 'Base Mainnet',
    PRIMARY_RPC: process.env.BASE_RPC_URL || 'https://mainnet.base.org',
    FALLBACK_RPC: process.env.BASE_RPC_FALLBACK_URL || 'https://1rpc.io/base',
    AAVE_V3_POOL: '0xA238Dd80C259a72e81d7e4664a9801593F98d1c5',
    AAVE_ORACLE: '0x2Cc0Fc26eD4563A5ce5e8bdcfe1A2878676Ae156',
  },
  PHAROS: {
    CHAIN_ID: 1672,
    CHAIN_NAME: 'Pharos Pacific Mainnet',
    RPC_URL: process.env.PHAROS_RPC_URL || 'https://rpc.pharos.xyz',
    CHAIN_MCP_URL: process.env.PHAROS_CHAIN_MCP_URL || 'https://mcp.pharos.xyz/mcp',
    DOCS_MCP_URL: process.env.PHAROS_DOCS_MCP_URL || 'https://docs.pharos.xyz/~gitbook/mcp',
  },
  THRESHOLDS: {
    DEFAULT_WARNING: 1.30,
    DEFAULT_CRITICAL: 1.10,
    DEFAULT_SAFETY_TARGET: 1.50,
  },
  SELECTORS: {
    GET_USER_ACCOUNT_DATA: '0xbf92857c', // getUserAccountData(address)
    GET_ASSET_PRICE: '0xb3596f07',       // getAssetPrice(address)
    BALANCE_OF: '0x70a08231',            // balanceOf(address)
    SCALED_BALANCE_OF: '0x1da24f3e',     // scaledBalanceOf(address)
    GET_RESERVES_LIST: '0xd1946dbc',     // getReservesList()
    GET_RESERVE_DATA: '0x35ea6a75',      // getReserveData(address)
    SET_USE_AS_COLLATERAL: '0x5a3b74b9', // setUserUseReserveAsCollateral(address,bool)
  },
  STALE_DATA_TIMEOUT_SECONDS: 120,
};

/**
 * Verified Core Reserves on Base Aave V3
 * Parameters audited directly from ReserveConfigurationMap on 0xA238Dd80C259a72e81d7e4664a9801593F98d1c5
 */
export const VERIFIED_RESERVES: ReserveAssetConfig[] = [
  {
    symbol: 'cbBTC',
    name: 'Coinbase Wrapped BTC',
    underlyingAddress: '0xcbb7c0000ab88b473b1f5afd9ef808440eed33bf',
    aTokenAddress: '0xbdb9300b7cde636d9cd4aff00f6f009ffbbc8ee6',
    variableDebtTokenAddress: '0x05e08702028de6aad395dc6478b554a56920b9ad',
    decimals: 8,
    ltvBps: 8100,                  // 81.00%
    liquidationThresholdBps: 8400, // 84.00%
    liquidationBonusBps: 10600,    // 106.00%
    isCollateralEligible: true,    // LTV > 0
    isActive: true,
  },
  {
    symbol: 'WETH',
    name: 'Wrapped Ether',
    underlyingAddress: '0x4200000000000000000000000000000000000006',
    aTokenAddress: '0xd4a0e0b9149bcee3c920d2e00b5de09138fd8bb7',
    variableDebtTokenAddress: '0x24e6e0795b3c7c71d965fcc4f371803d1c1dca1e',
    decimals: 18,
    ltvBps: 8100,                  // 81.00%
    liquidationThresholdBps: 8400, // 84.00%
    liquidationBonusBps: 10500,    // 105.00%
    isCollateralEligible: true,    // LTV > 0
    isActive: true,
  },
  {
    symbol: 'USDC',
    name: 'USD Coin',
    underlyingAddress: '0x833589fcd6edb6e08f4c7c32d4f71b54bda02913',
    aTokenAddress: '0x4e65fe4dba92790696d040ac24aa414708f5c0ab',
    variableDebtTokenAddress: '0x59dca05b6c26dbd64b5381374aaac5cd05644c28',
    decimals: 6,
    ltvBps: 0,                     // 0.00% LTV (Governance disabled borrow margin)
    liquidationThresholdBps: 7800, // 78.00%
    liquidationBonusBps: 10500,    // 105.00%
    isCollateralEligible: false,   // INELIGIBLE (LTV == 0, setUserUseReserveAsCollateral reverts 0x21e5c4ae)
    isActive: true,
  },
  {
    symbol: 'cbETH',
    name: 'Coinbase Wrapped Staked ETH',
    underlyingAddress: '0x2ae3f1ec7f1f5012cfeab0185bfc7aa3cf0dec22',
    aTokenAddress: '0x8a920272e5052adcfd1ba28d44ec6dbdf2d0e74b',
    variableDebtTokenAddress: '0x59714856f7efb0dd6478d8a7cba8b1c4b791010d',
    decimals: 18,
    ltvBps: 7500,                  // 75.00%
    liquidationThresholdBps: 7800, // 78.00%
    liquidationBonusBps: 10750,    // 107.50%
    isCollateralEligible: true,    // LTV > 0
    isActive: true,
  },
  {
    symbol: 'wstETH',
    name: 'Wrapped Staked Ether',
    underlyingAddress: '0xc1cba3fcea344f92d9239c08c0568f6f2f0ee452',
    aTokenAddress: '0x04c0599ae5a44757c0af6f9ec3b93da8976c150a',
    variableDebtTokenAddress: '0x4db4e0b57e7cb28387ea310d7054a3952ba57161',
    decimals: 18,
    ltvBps: 7500,                  // 75.00%
    liquidationThresholdBps: 7800, // 78.00%
    liquidationBonusBps: 10750,    // 107.50%
    isCollateralEligible: true,    // LTV > 0
    isActive: true,
  }
];
