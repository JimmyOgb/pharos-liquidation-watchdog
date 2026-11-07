/**
 * Liquidation Watchdog - Deterministic Risk Evaluator
 *
 * Implements deterministic risk evaluation, health-factor classification,
 * repayment calculation, and asset-specific collateral addition recommendations.
 *
 * All recommendations are explicitly labeled:
 * 'ESTIMATE — NOT AN EXECUTABLE TRANSACTION'
 */

import { CONFIG, VERIFIED_RESERVES } from '../config/index.ts';
import type {
  RiskState,
  UserThresholds,
  UserAssetBalance,
  RecommendedAction,
  PositionReport,
} from '../types/index.ts';
import type { RawUserAccountData } from '../protocols/aaveV3Base.ts';
import { PharosMcpClient } from '../mcp/pharosClients.ts';

export class RiskEvaluator {
  /**
   * Classify risk state according to deterministic threshold hierarchy:
   * 1. No active debt -> HEALTHY
   * 2. HF <= 1.0 -> LIQUIDATION RISK
   * 3. HF <= criticalThreshold (default 1.10) -> CRITICAL
   * 4. HF <= warningThreshold (default 1.30) -> WARNING
   * 5. Otherwise -> HEALTHY
   */
  public static classifyRisk(
    healthFactor: number,
    hasActiveDebt: boolean,
    thresholds: UserThresholds
  ): RiskState {
    if (!hasActiveDebt || healthFactor === Infinity || healthFactor === 0) {
      return 'HEALTHY';
    }

    if (healthFactor <= 1.0) {
      return 'LIQUIDATION RISK';
    }

    if (healthFactor <= thresholds.criticalThreshold) {
      return 'CRITICAL';
    }

    if (healthFactor <= thresholds.warningThreshold) {
      return 'WARNING';
    }

    return 'HEALTHY';
  }

  /**
   * Calculate debt repayment needed to reach target health factor.
   *
   * Formula:
   * HF_target = (TotalCollateralBase * CurrentLT) / TargetDebtBase
   * TargetDebtBase = (TotalCollateralBase * CurrentLT) / HF_target
   * DebtRepaymentBase = max(0, TotalDebtBase - TargetDebtBase)
   *
   * Token units are calculated using token price with floor rounding.
   */
  public static calculateRepayment(
    totalCollateralUSD: number,
    totalDebtUSD: number,
    currentLiquidationThresholdBps: number,
    targetHF: number,
    debtAssetSymbol: string,
    debtAssetPriceUSD: number,
    debtAssetDecimals: number
  ): RecommendedAction {
    const ltFraction = currentLiquidationThresholdBps / 10000;
    const maxSafeDebtUSD = targetHF > 0 ? (totalCollateralUSD * ltFraction) / targetHF : 0;
    const repaymentUSD = Math.max(0, totalDebtUSD - maxSafeDebtUSD);

    let requiredTokens = 0;
    let rawTokenUnits = '0';

    if (repaymentUSD > 0 && debtAssetPriceUSD > 0) {
      requiredTokens = repaymentUSD / debtAssetPriceUSD;
      // Floor rounding for repayment token integer representation
      const factor = Math.pow(10, debtAssetDecimals);
      const rawInt = BigInt(Math.floor(requiredTokens * factor));
      rawTokenUnits = rawInt.toString();
    }

    return {
      type: 'DEBT_REPAYMENT',
      assetSymbol: debtAssetSymbol,
      targetHealthFactor: targetHF,
      requiredUSD: Number(repaymentUSD.toFixed(2)),
      requiredTokens: Number(requiredTokens.toFixed(6)),
      rawTokenUnits,
      tokenDecimals: debtAssetDecimals,
      explanation: repaymentUSD > 0
        ? `Repaying approximately $${repaymentUSD.toFixed(2)} (${requiredTokens.toFixed(4)} ${debtAssetSymbol}) reduces total debt to $${maxSafeDebtUSD.toFixed(2)}, restoring Health Factor to safety target ${targetHF.toFixed(2)}.`
        : `Position debt is already within safety margin for target Health Factor ${targetHF.toFixed(2)}.`,
      isEligible: true,
      disclaimer: 'ESTIMATE — NOT AN EXECUTABLE TRANSACTION',
    };
  }

  /**
   * Calculate asset-specific collateral addition required to reach target health factor.
   *
   * Formula:
   * HF_target = ((TotalCollateralBase * CurrentLT) + (AddedCollateralBase * AssetLT)) / TotalDebtBase
   * AddedCollateralBase * AssetLT = (TotalDebtBase * HF_target) - (TotalCollateralBase * CurrentLT)
   * AddedCollateralBase = max(0, ((TotalDebtBase * HF_target) - (TotalCollateralBase * CurrentLT)) / AssetLT)
   *
   * Crucial Protocol Guardrail:
   * If asset has 0% LTV (e.g. USDC on Base Aave V3), it CANNOT be enabled as collateral.
   * Calling setUserUseReserveAsCollateral reverts on-chain with UserHasAssetWithZeroLtv() (0x21e5c4ae).
   * For such assets, isEligible is false and ineligibilityReason explains the protocol invariant.
   */
  public static calculateCollateralAddition(
    totalCollateralUSD: number,
    totalDebtUSD: number,
    currentLiquidationThresholdBps: number,
    targetHF: number,
    reserveSymbol: string,
    reservePriceUSD: number,
    reserveDecimals: number,
    reserveLtBps: number,
    isCollateralEligible: boolean
  ): RecommendedAction {
    if (!isCollateralEligible || reserveLtBps <= 0) {
      return {
        type: 'COLLATERAL_ADDITION',
        assetSymbol: reserveSymbol,
        targetHealthFactor: targetHF,
        requiredUSD: 0,
        requiredTokens: 0,
        rawTokenUnits: '0',
        tokenDecimals: reserveDecimals,
        explanation: `${reserveSymbol} has 0% LTV on Base Aave V3 and cannot be enabled as collateral. Deposited ${reserveSymbol} earns yield only and does not protect position health factor.`,
        isEligible: false,
        ineligibilityReason: `${reserveSymbol} has 0% LTV on Base Aave V3. Calling setUserUseReserveAsCollateral reverts on-chain with UserHasAssetWithZeroLtv() (0x21e5c4ae).`,
        disclaimer: 'ESTIMATE — NOT AN EXECUTABLE TRANSACTION',
      };
    }

    const currentLtFraction = currentLiquidationThresholdBps / 10000;
    const assetLtFraction = reserveLtBps / 10000;

    const currentWeightedCollateral = totalCollateralUSD * currentLtFraction;
    const requiredWeightedCollateral = totalDebtUSD * targetHF;
    const deficitUSD = Math.max(0, requiredWeightedCollateral - currentWeightedCollateral);
    const requiredCollateralUSD = deficitUSD / assetLtFraction;

    let requiredTokens = 0;
    let rawTokenUnits = '0';

    if (requiredCollateralUSD > 0 && reservePriceUSD > 0) {
      requiredTokens = requiredCollateralUSD / reservePriceUSD;
      // Ceiling rounding for collateral integer representation to guarantee safety margin
      const factor = Math.pow(10, reserveDecimals);
      const rawInt = BigInt(Math.ceil(requiredTokens * factor));
      rawTokenUnits = rawInt.toString();
    }

    return {
      type: 'COLLATERAL_ADDITION',
      assetSymbol: reserveSymbol,
      targetHealthFactor: targetHF,
      requiredUSD: Number(requiredCollateralUSD.toFixed(2)),
      requiredTokens: Number(requiredTokens.toFixed(6)),
      rawTokenUnits,
      tokenDecimals: reserveDecimals,
      explanation: requiredCollateralUSD > 0
        ? `Depositing approximately $${requiredCollateralUSD.toFixed(2)} (${requiredTokens.toFixed(4)} ${reserveSymbol} at ${(assetLtFraction * 100).toFixed(0)}% liquidation threshold) raises weighted collateral by $${deficitUSD.toFixed(2)}, restoring Health Factor to safety target ${targetHF.toFixed(2)}.`
        : `Position collateral is already sufficient for target Health Factor ${targetHF.toFixed(2)}.`,
      isEligible: true,
      disclaimer: 'ESTIMATE — NOT AN EXECUTABLE TRANSACTION',
    };
  }

  /**
   * Produce comprehensive position evaluation report
   */
  public static evaluatePosition(
    walletAddress: string,
    rawData: RawUserAccountData,
    blockNumber: number,
    assetBreakdown: UserAssetBalance[],
    userThresholds: Partial<UserThresholds> = {},
    mcpClient?: PharosMcpClient
  ): PositionReport {
    const thresholds: UserThresholds = {
      warningThreshold: userThresholds.warningThreshold ?? CONFIG.THRESHOLDS.DEFAULT_WARNING,
      criticalThreshold: userThresholds.criticalThreshold ?? CONFIG.THRESHOLDS.DEFAULT_CRITICAL,
      safetyTarget: userThresholds.safetyTarget ?? CONFIG.THRESHOLDS.DEFAULT_SAFETY_TARGET,
    };

    const totalCollateralUSD = Number(rawData.totalCollateralBase) / 1e8;
    const totalDebtUSD = Number(rawData.totalDebtBase) / 1e8;
    const availableBorrowsUSD = Number(rawData.availableBorrowsBase) / 1e8;
    const currentLtBps = Number(rawData.currentLiquidationThreshold);
    const currentLtPct = currentLtBps / 100;
    const ltvPct = Number(rawData.ltv) / 100;

    const hasActiveDebt = rawData.totalDebtBase > 0n;

    // Health factor calculation
    let healthFactor = Infinity;
    let healthFactorFormatted = '∞ (No Debt)';

    if (hasActiveDebt) {
      // In Aave V3, healthFactor is scaled by 1e18 (WAD)
      healthFactor = Number(rawData.healthFactor) / 1e18;
      healthFactorFormatted = healthFactor.toFixed(4);
    }

    const riskState = this.classifyRisk(healthFactor, hasActiveDebt, thresholds);
    const isHealthy = riskState === 'HEALTHY';

    // Generate recommendations if HF is below target safety threshold
    const recommendations: RecommendedAction[] = [];

    if (hasActiveDebt && healthFactor < thresholds.safetyTarget) {
      // Find primary debt asset (e.g. USDC or first asset with debt)
      const primaryDebtAsset = assetBreakdown.find(a => a.debtUSD > 0) || assetBreakdown.find(a => a.symbol === 'USDC');
      const debtSymbol = primaryDebtAsset?.symbol || 'USDC';
      const debtPrice = primaryDebtAsset?.oraclePriceUSD || 1.0;
      const debtDecimals = primaryDebtAsset?.decimals || 6;

      // 1. Debt repayment recommendation
      recommendations.push(
        this.calculateRepayment(
          totalCollateralUSD,
          totalDebtUSD,
          currentLtBps,
          thresholds.safetyTarget,
          debtSymbol,
          debtPrice,
          debtDecimals
        )
      );

      // 2. Collateral addition recommendations for each verified reserve
      for (const reserve of VERIFIED_RESERVES) {
        const userAsset = assetBreakdown.find(a => a.symbol === reserve.symbol);
        const priceUSD = userAsset?.oraclePriceUSD || 1.0;

        recommendations.push(
          this.calculateCollateralAddition(
            totalCollateralUSD,
            totalDebtUSD,
            currentLtBps,
            thresholds.safetyTarget,
            reserve.symbol,
            priceUSD,
            reserve.decimals,
            reserve.liquidationThresholdBps,
            reserve.isCollateralEligible
          )
        );
      }
    }

    if (mcpClient) {
      mcpClient.recordProvenance(
        `Risk Evaluation for ${walletAddress} (RiskState: ${riskState}, HF: ${healthFactorFormatted})`,
        'Deterministic Risk Engine',
        'local://engine/riskEvaluator',
        {
          walletAddress,
          riskState,
          healthFactor,
          recommendationsCount: recommendations.length,
        }
      );
    }

    return {
      walletAddress,
      network: CONFIG.BASE.CHAIN_NAME,
      chainId: CONFIG.BASE.CHAIN_ID,
      protocol: 'Aave V3',
      blockNumber,
      observationTimestamp: new Date().toISOString(),
      totalCollateralUSD: Number(totalCollateralUSD.toFixed(2)),
      totalDebtUSD: Number(totalDebtUSD.toFixed(2)),
      availableBorrowsUSD: Number(availableBorrowsUSD.toFixed(2)),
      currentLiquidationThresholdPct: currentLtPct,
      ltvPct,
      healthFactor: hasActiveDebt ? healthFactor : 999999,
      healthFactorFormatted,
      isHealthy,
      riskState,
      hasActiveDebt,
      thresholds,
      assetBreakdown,
      recommendations,
      provenance: mcpClient ? [...mcpClient.provenance] : [],
      freshnessStatus: 'LIVE',
    };
  }
}
