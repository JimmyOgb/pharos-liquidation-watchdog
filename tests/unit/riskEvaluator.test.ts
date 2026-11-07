/**
 * Unit Tests - Deterministic Risk Evaluator
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { RiskEvaluator } from '../../src/engine/riskEvaluator.ts';
import type { UserThresholds } from '../../src/types/index.ts';

const defaultThresholds: UserThresholds = {
  warningThreshold: 1.30,
  criticalThreshold: 1.10,
  safetyTarget: 1.50,
};

describe('RiskEvaluator - Threshold Classification', () => {
  it('TC1: No active debt is classified as HEALTHY regardless of HF value', () => {
    const res = RiskEvaluator.classifyRisk(0, false, defaultThresholds);
    assert.equal(res, 'HEALTHY');

    const resInf = RiskEvaluator.classifyRisk(Infinity, false, defaultThresholds);
    assert.equal(resInf, 'HEALTHY');
  });

  it('TC2: HF <= 1.0 is classified as LIQUIDATION RISK', () => {
    assert.equal(RiskEvaluator.classifyRisk(1.0, true, defaultThresholds), 'LIQUIDATION RISK');
    assert.equal(RiskEvaluator.classifyRisk(0.985, true, defaultThresholds), 'LIQUIDATION RISK');
  });

  it('TC3: HF <= criticalThreshold (1.10) is classified as CRITICAL', () => {
    assert.equal(RiskEvaluator.classifyRisk(1.05, true, defaultThresholds), 'CRITICAL');
    assert.equal(RiskEvaluator.classifyRisk(1.10, true, defaultThresholds), 'CRITICAL');
  });

  it('TC4: HF <= warningThreshold (1.30) is classified as WARNING', () => {
    assert.equal(RiskEvaluator.classifyRisk(1.15, true, defaultThresholds), 'WARNING');
    assert.equal(RiskEvaluator.classifyRisk(1.30, true, defaultThresholds), 'WARNING');
  });

  it('TC5: HF > warningThreshold is classified as HEALTHY', () => {
    assert.equal(RiskEvaluator.classifyRisk(1.31, true, defaultThresholds), 'HEALTHY');
    assert.equal(RiskEvaluator.classifyRisk(4.1031, true, defaultThresholds), 'HEALTHY');
  });
});

describe('RiskEvaluator - Debt Repayment Recommendations', () => {
  it('TC6: Calculates debt repayment required to restore HF to target', () => {
    // Scenario: Collateral = $1,000, Debt = $800, LT = 84% (0.84), Target HF = 1.50
    // Max safe debt = (1000 * 0.84) / 1.50 = 840 / 1.50 = $560.00
    // Repayment needed = $800 - $560 = $240.00
    const rec = RiskEvaluator.calculateRepayment(
      1000.0,
      800.0,
      8400, // 84.00%
      1.50,
      'USDC',
      1.0,  // $1.00 per USDC
      6     // 6 decimals
    );

    assert.equal(rec.type, 'DEBT_REPAYMENT');
    assert.equal(rec.assetSymbol, 'USDC');
    assert.equal(rec.targetHealthFactor, 1.50);
    assert.equal(rec.requiredUSD, 240.00);
    assert.equal(rec.requiredTokens, 240.00);
    assert.equal(rec.rawTokenUnits, '240000000'); // 240 * 1e6
    assert.equal(rec.isEligible, true);
    assert.equal(rec.disclaimer, 'ESTIMATE — NOT AN EXECUTABLE TRANSACTION');
  });

  it('TC7: Returns 0 repayment if position already satisfies target HF', () => {
    // Collateral = $4,743.00, Debt = $971.01, LT = 84%, Target = 1.50
    // Max safe debt = (4743 * 0.84) / 1.50 = $2,656.08 > $971.01
    const rec = RiskEvaluator.calculateRepayment(
      4743.00,
      971.01,
      8400,
      1.50,
      'USDC',
      1.0,
      6
    );

    assert.equal(rec.requiredUSD, 0);
    assert.equal(rec.requiredTokens, 0);
    assert.equal(rec.rawTokenUnits, '0');
    assert.match(rec.explanation, /already within safety margin/i);
  });
});

describe('RiskEvaluator - Collateral Addition & Zero-LTV Guardrails', () => {
  it('TC8: Rejects USDC collateral recommendation due to 0% LTV invariant', () => {
    const rec = RiskEvaluator.calculateCollateralAddition(
      1000.0,
      800.0,
      8400,
      1.50,
      'USDC',
      1.0,
      6,
      0,     // 0% LT
      false  // isCollateralEligible = false
    );

    assert.equal(rec.type, 'COLLATERAL_ADDITION');
    assert.equal(rec.assetSymbol, 'USDC');
    assert.equal(rec.isEligible, false);
    assert.equal(rec.requiredUSD, 0);
    assert.equal(rec.requiredTokens, 0);
    assert.match(rec.ineligibilityReason || '', /0% LTV/i);
    assert.match(rec.ineligibilityReason || '', /0x21e5c4ae/i);
    assert.equal(rec.disclaimer, 'ESTIMATE — NOT AN EXECUTABLE TRANSACTION');
  });

  it('TC9: Calculates asset-specific collateral addition for WETH (LT = 84%)', () => {
    // Scenario: Collateral = $1,000, Debt = $800, Current LT = 84%, Target HF = 1.50
    // Required weighted collateral = 800 * 1.50 = $1,200
    // Current weighted collateral = 1000 * 0.84 = $840
    // Deficit = $1200 - $840 = $360
    // WETH LT = 84% (0.84)
    // Required WETH USD = 360 / 0.84 = $428.5714...
    // WETH Price = $2,000, Decimals = 18
    // Required tokens = 428.5714... / 2000 = ~0.214285 WETH
    const rec = RiskEvaluator.calculateCollateralAddition(
      1000.0,
      800.0,
      8400,
      1.50,
      'WETH',
      2000.0,
      18,
      8400,
      true
    );

    assert.equal(rec.type, 'COLLATERAL_ADDITION');
    assert.equal(rec.assetSymbol, 'WETH');
    assert.equal(rec.isEligible, true);
    assert.equal(rec.requiredUSD, 428.57);
    assert.ok(rec.requiredTokens > 0.214 && rec.requiredTokens < 0.215);
    assert.ok(BigInt(rec.rawTokenUnits) > 0n);
    assert.equal(rec.disclaimer, 'ESTIMATE — NOT AN EXECUTABLE TRANSACTION');
  });
});

describe('RiskEvaluator - Full Position Evaluation', () => {
  it('TC10: Evaluates verified live borrower fixture correctly', () => {
    const rawData = {
      totalCollateralBase: 474300306366n, // $4,743.00
      totalDebtBase: 97101264314n,        // $971.01
      availableBorrowsBase: 287082003842n,
      currentLiquidationThreshold: 8400n, // 84.00%
      ltv: 8100n,                         // 81.00%
      healthFactor: 4103059421132554379n, // 4.103059...
      rawHex: '0x...',
    };

    const assetBreakdown = [
      {
        symbol: 'cbBTC',
        underlyingAddress: '0xcbb7c0000ab88b473b1f5afd9ef808440eed33bf',
        decimals: 8,
        aTokenBalanceRaw: '7025816',
        aTokenBalanceUnits: 0.07025816,
        variableDebtRaw: '0',
        variableDebtUnits: 0,
        oraclePriceUSD: 67106.32,
        collateralUSD: 4714.77,
        debtUSD: 0,
        isAccountCollateralEnabled: true,
        statusLabel: 'Active Collateral' as const,
      },
      {
        symbol: 'USDC',
        underlyingAddress: '0x833589fcd6edb6e08f4c7c32d4f71b54bda02913',
        decimals: 6,
        aTokenBalanceRaw: '0',
        aTokenBalanceUnits: 0,
        variableDebtRaw: '971012643',
        variableDebtUnits: 971.012643,
        oraclePriceUSD: 1.0,
        collateralUSD: 0,
        debtUSD: 971.01,
        isAccountCollateralEnabled: false,
        statusLabel: 'Active Debt' as const,
      },
    ];

    const report = RiskEvaluator.evaluatePosition(
      '0xcbc3301782507d85e57db83d7d19db2a82478570',
      rawData,
      54404716,
      assetBreakdown,
      defaultThresholds
    );

    assert.equal(report.walletAddress, '0xcbc3301782507d85e57db83d7d19db2a82478570');
    assert.equal(report.riskState, 'HEALTHY');
    assert.equal(report.isHealthy, true);
    assert.equal(report.totalCollateralUSD, 4743.00);
    assert.equal(report.totalDebtUSD, 971.01);
    assert.equal(report.currentLiquidationThresholdPct, 84.00);
    assert.equal(report.healthFactorFormatted, '4.1031');
    assert.equal(report.freshnessStatus, 'LIVE');
  });
});
