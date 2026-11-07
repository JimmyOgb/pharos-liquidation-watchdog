/**
 * Liquidation Watchdog - Core TypeScript Interfaces
 */

export const PROTOCOL_VERSION = 'Aave V3 Base';

export type RiskState = 
  | 'HEALTHY' 
  | 'WARNING' 
  | 'CRITICAL' 
  | 'LIQUIDATION RISK' 
  | 'DATA UNAVAILABLE';

export interface UserThresholds {
  warningThreshold: number;   // Default 1.30
  criticalThreshold: number;  // Default 1.10
  safetyTarget: number;       // Default 1.50
}

export interface ReserveAssetConfig {
  symbol: string;
  name: string;
  underlyingAddress: string;
  aTokenAddress: string;
  variableDebtTokenAddress: string;
  decimals: number;
  ltvBps: number;              // Basis points (e.g. 8100 = 81%)
  liquidationThresholdBps: number; // Basis points (e.g. 8400 = 84%)
  liquidationBonusBps: number;     // Basis points (e.g. 10600 = 106%)
  isCollateralEligible: boolean;   // true if ltvBps > 0
  isActive: boolean;
}

export interface UserAssetBalance {
  symbol: string;
  underlyingAddress: string;
  decimals: number;
  aTokenBalanceRaw: string;
  aTokenBalanceUnits: number;
  variableDebtRaw: string;
  variableDebtUnits: number;
  oraclePriceUSD: number;
  collateralUSD: number;
  debtUSD: number;
  isAccountCollateralEnabled: boolean;
  statusLabel: 'Active Collateral' | 'Yield-Only Deposit' | 'Active Debt' | 'Inactive';
}

export interface RecommendedAction {
  type: 'DEBT_REPAYMENT' | 'COLLATERAL_ADDITION';
  assetSymbol: string;
  targetHealthFactor: number;
  requiredUSD: number;
  requiredTokens: number;
  rawTokenUnits: string;
  tokenDecimals: number;
  explanation: string;
  isEligible: boolean;
  ineligibilityReason?: string;
  disclaimer: 'ESTIMATE — NOT AN EXECUTABLE TRANSACTION';
}

export interface ProvenanceRecord {
  step: string;
  source: 'Base Mainnet (8453)' | 'Pharos Chain MCP (1672)' | 'Pharos Docs MCP' | 'Deterministic Risk Engine';
  endpoint: string;
  callData?: string;
  rawResponseSha256: string;
  timestamp: string;
}

export interface PositionReport {
  walletAddress: string;
  network: string;
  chainId: number;
  protocol: string;
  blockNumber: number;
  observationTimestamp: string;
  totalCollateralUSD: number;
  totalDebtUSD: number;
  availableBorrowsUSD: number;
  currentLiquidationThresholdPct: number;
  ltvPct: number;
  healthFactor: number;
  healthFactorFormatted: string;
  isHealthy: boolean;
  riskState: RiskState;
  hasActiveDebt: boolean;
  thresholds: UserThresholds;
  assetBreakdown: UserAssetBalance[];
  recommendations: RecommendedAction[];
  provenance: ProvenanceRecord[];
  freshnessStatus: 'LIVE' | 'STALE' | 'UNAVAILABLE';
}

export interface AlertEvent {
  id: string;
  timestamp: string;
  walletAddress: string;
  previousRiskState: RiskState;
  currentRiskState: RiskState;
  healthFactor: number;
  triggeredThreshold: number;
  severity: 'INFO' | 'WARNING' | 'CRITICAL' | 'RECOVERY';
  message: string;
  primaryActionSummary: string;
}
