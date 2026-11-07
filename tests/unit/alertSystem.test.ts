/**
 * Unit Tests - Alert System & Deduplication Engine
 */

import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { AlertSystem } from '../../src/engine/alertSystem.ts';
import type { PositionReport } from '../../src/types/index.ts';

function createMockReport(
  healthFactor: number,
  riskState: PositionReport['riskState'],
  walletAddress = '0x1111111111111111111111111111111111111111'
): PositionReport {
  return {
    walletAddress,
    network: 'Base Mainnet',
    chainId: 8453,
    protocol: 'Aave V3',
    blockNumber: 54400000,
    observationTimestamp: new Date().toISOString(),
    totalCollateralUSD: 1000.0,
    totalDebtUSD: 500.0,
    availableBorrowsUSD: 100.0,
    currentLiquidationThresholdPct: 84.0,
    ltvPct: 81.0,
    healthFactor,
    healthFactorFormatted: healthFactor.toFixed(4),
    isHealthy: riskState === 'HEALTHY',
    riskState,
    hasActiveDebt: true,
    thresholds: {
      warningThreshold: 1.30,
      criticalThreshold: 1.10,
      safetyTarget: 1.50,
    },
    assetBreakdown: [],
    recommendations: [],
    provenance: [],
    freshnessStatus: 'LIVE',
  };
}

describe('AlertSystem - Threshold Crossings & State Transitions', () => {
  let alertSys: AlertSystem;

  beforeEach(() => {
    alertSys = new AlertSystem();
  });

  it('TC11: Initial healthy position emits no alert', () => {
    const rep = createMockReport(2.5, 'HEALTHY');
    const alert = alertSys.processReport(rep);
    assert.equal(alert, null);
    assert.equal(alertSys.getLedger().length, 0);
  });

  it('TC12: Transition from HEALTHY to WARNING emits WARNING alert', () => {
    const rep1 = createMockReport(1.5, 'HEALTHY');
    alertSys.processReport(rep1);

    const rep2 = createMockReport(1.25, 'WARNING');
    const alert = alertSys.processReport(rep2);

    assert.ok(alert !== null);
    assert.equal(alert.severity, 'WARNING');
    assert.equal(alert.previousRiskState, 'HEALTHY');
    assert.equal(alert.currentRiskState, 'WARNING');
    assert.match(alert.message, /WARNING zone/i);
    assert.equal(alertSys.getLedger().length, 1);
  });

  it('TC13: Transition from WARNING to CRITICAL emits CRITICAL alert', () => {
    const rep1 = createMockReport(1.25, 'WARNING');
    alertSys.processReport(rep1);

    const rep2 = createMockReport(1.05, 'CRITICAL');
    const alert = alertSys.processReport(rep2);

    assert.ok(alert !== null);
    assert.equal(alert.severity, 'CRITICAL');
    assert.equal(alert.previousRiskState, 'WARNING');
    assert.equal(alert.currentRiskState, 'CRITICAL');
    assert.match(alert.message, /CRITICAL threshold/i);
  });

  it('TC14: Transition to LIQUIDATION RISK (HF <= 1.0) emits CRITICAL alert', () => {
    const rep1 = createMockReport(1.05, 'CRITICAL');
    alertSys.processReport(rep1);

    const rep2 = createMockReport(0.98, 'LIQUIDATION RISK');
    const alert = alertSys.processReport(rep2);

    assert.ok(alert !== null);
    assert.equal(alert.severity, 'CRITICAL');
    assert.equal(alert.currentRiskState, 'LIQUIDATION RISK');
    assert.match(alert.message, /immediate liquidation/i);
  });

  it('TC15: Recovery transition from CRITICAL back to HEALTHY emits RECOVERY alert', () => {
    const rep1 = createMockReport(1.05, 'CRITICAL');
    alertSys.processReport(rep1);

    const rep2 = createMockReport(1.65, 'HEALTHY');
    const alert = alertSys.processReport(rep2);

    assert.ok(alert !== null);
    assert.equal(alert.severity, 'RECOVERY');
    assert.equal(alert.previousRiskState, 'CRITICAL');
    assert.equal(alert.currentRiskState, 'HEALTHY');
    assert.match(alert.message, /RECOVERY/i);
  });
});

describe('AlertSystem - Deduplication Window', () => {
  let alertSys: AlertSystem;

  beforeEach(() => {
    alertSys = new AlertSystem();
  });

  it('TC16: Deduplicates consecutive polls when state unchanged and |ΔHF| < 0.01', () => {
    const rep1 = createMockReport(1.25, 'WARNING');
    const alert1 = alertSys.processReport(rep1);
    assert.ok(alert1 !== null);

    // Minor fluctuation: HF drops to 1.245 (|ΔHF| = 0.005 < 0.01)
    const rep2 = createMockReport(1.245, 'WARNING');
    const alert2 = alertSys.processReport(rep2);
    assert.equal(alert2, null, 'Expected alert to be deduplicated');

    // Another micro fluctuation
    const rep3 = createMockReport(1.252, 'WARNING');
    const alert3 = alertSys.processReport(rep3);
    assert.equal(alert3, null, 'Expected alert to be deduplicated');

    // Total alerts in ledger should remain 1
    assert.equal(alertSys.getLedger().length, 1);
  });

  it('TC17: Per-wallet alert ledger filtering works correctly', () => {
    const w1 = '0x1111111111111111111111111111111111111111';
    const w2 = '0x2222222222222222222222222222222222222222';

    alertSys.processReport(createMockReport(1.2, 'WARNING', w1));
    alertSys.processReport(createMockReport(1.05, 'CRITICAL', w2));

    const all = alertSys.getLedger();
    const w1Ledger = alertSys.getLedger(w1);
    const w2Ledger = alertSys.getLedger(w2);

    assert.equal(all.length, 2);
    assert.equal(w1Ledger.length, 1);
    assert.equal(w2Ledger.length, 1);
    assert.equal(w1Ledger[0].walletAddress, w1);
    assert.equal(w2Ledger[0].walletAddress, w2);
  });
});
