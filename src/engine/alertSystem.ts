/**
 * Liquidation Watchdog - Alert System
 *
 * Implements threshold-crossing detection, 10-minute alert deduplication
 * for minor fluctuations (|ΔHF| < 0.01), recovery notifications, and an in-memory alert ledger.
 */

import type { AlertEvent, RiskState, PositionReport } from '../types/index.ts';

interface LastAlertState {
  riskState: RiskState;
  healthFactor: number;
  timestampMs: number;
}

export class AlertSystem {
  private alertLedger: AlertEvent[] = [];
  private lastAlerts: Map<string, LastAlertState> = new Map();
  private readonly deduplicationWindowMs = 10 * 60 * 1000; // 10 minutes

  /**
   * Process a position report and generate an alert if a threshold is crossed or meaningful change occurred
   */
  public processReport(report: PositionReport): AlertEvent | null {
    const walletKey = report.walletAddress.toLowerCase();
    const lastState = this.lastAlerts.get(walletKey);
    const now = Date.now();

    const currentHF = report.healthFactor;
    const currentRisk = report.riskState;
    const prevRisk = lastState ? lastState.riskState : 'HEALTHY';

    // Check if this is the first observation
    if (!lastState) {
      this.lastAlerts.set(walletKey, {
        riskState: currentRisk,
        healthFactor: currentHF,
        timestampMs: now,
      });

      // If initial state is already at risk, emit initial alert
      if (currentRisk !== 'HEALTHY') {
        const alert = this.createAlert(
          report,
          'HEALTHY',
          currentRisk,
          currentRisk === 'CRITICAL' || currentRisk === 'LIQUIDATION RISK' ? 'CRITICAL' : 'WARNING'
        );
        this.alertLedger.unshift(alert);
        return alert;
      }
      return null;
    }

    const stateChanged = prevRisk !== currentRisk;
    const hfDelta = Math.abs(currentHF - lastState.healthFactor);
    const timeSinceLastAlert = now - lastState.timestampMs;

    // Deduplication rule: If state did not change and |ΔHF| < 0.01 within 10 minutes, suppress
    if (!stateChanged && hfDelta < 0.01 && timeSinceLastAlert < this.deduplicationWindowMs) {
      return null;
    }

    // Determine event severity
    let severity: AlertEvent['severity'] = 'INFO';
    let shouldEmit = false;

    if (stateChanged) {
      shouldEmit = true;
      if (currentRisk === 'LIQUIDATION RISK') {
        severity = 'CRITICAL';
      } else if (currentRisk === 'CRITICAL') {
        severity = 'CRITICAL';
      } else if (currentRisk === 'WARNING') {
        severity = 'WARNING';
      } else if (currentRisk === 'HEALTHY' && (prevRisk === 'WARNING' || prevRisk === 'CRITICAL' || prevRisk === 'LIQUIDATION RISK')) {
        severity = 'RECOVERY';
      }
    } else if (currentRisk !== 'HEALTHY' && timeSinceLastAlert >= this.deduplicationWindowMs && hfDelta >= 0.01) {
      // Repeat reminder if position remains degraded beyond deduplication window with material drift
      shouldEmit = true;
      severity = currentRisk === 'LIQUIDATION RISK' || currentRisk === 'CRITICAL' ? 'CRITICAL' : 'WARNING';
    }

    if (!shouldEmit) {
      return null;
    }

    const alert = this.createAlert(report, prevRisk, currentRisk, severity);
    this.alertLedger.unshift(alert);

    // Keep ledger bounded to latest 200 events
    if (this.alertLedger.length > 200) {
      this.alertLedger.pop();
    }

    this.lastAlerts.set(walletKey, {
      riskState: currentRisk,
      healthFactor: currentHF,
      timestampMs: now,
    });

    return alert;
  }

  /**
   * Format human-readable message and actionable summary
   */
  private createAlert(
    report: PositionReport,
    prevRisk: RiskState,
    currentRisk: RiskState,
    severity: AlertEvent['severity']
  ): AlertEvent {
    const id = `alt_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const hfStr = report.healthFactorFormatted;
    let message = '';
    let primaryAction = 'Monitor position status.';
    let triggeredThreshold = report.thresholds.warningThreshold;

    if (currentRisk === 'LIQUIDATION RISK') {
      triggeredThreshold = 1.0;
      message = `CRITICAL ALERT: Health Factor ${hfStr} has dropped to or below 1.00. This position is subject to immediate liquidation!`;
    } else if (currentRisk === 'CRITICAL') {
      triggeredThreshold = report.thresholds.criticalThreshold;
      message = `WARNING: Position crossed CRITICAL threshold (${report.thresholds.criticalThreshold.toFixed(2)}). Current Health Factor is ${hfStr}.`;
    } else if (currentRisk === 'WARNING') {
      triggeredThreshold = report.thresholds.warningThreshold;
      message = `CAUTION: Position entered WARNING zone (${report.thresholds.warningThreshold.toFixed(2)}). Current Health Factor is ${hfStr}.`;
    } else if (severity === 'RECOVERY') {
      triggeredThreshold = report.thresholds.safetyTarget;
      message = `RECOVERY: Health Factor restored to ${hfStr} (Safety target: ${report.thresholds.safetyTarget.toFixed(2)}). Position is HEALTHY.`;
      primaryAction = 'No immediate action required.';
    }

    const firstAction = report.recommendations.find(r => r.isEligible);
    if (firstAction && severity !== 'RECOVERY') {
      primaryAction = firstAction.explanation;
    }

    return {
      id,
      timestamp: new Date().toISOString(),
      walletAddress: report.walletAddress,
      previousRiskState: prevRisk,
      currentRiskState: currentRisk,
      healthFactor: report.healthFactor,
      triggeredThreshold,
      severity,
      message,
      primaryActionSummary: primaryAction,
    };
  }

  /**
   * Return full or filtered alert ledger
   */
  public getLedger(walletAddress?: string): AlertEvent[] {
    if (!walletAddress) return [...this.alertLedger];
    const target = walletAddress.toLowerCase();
    return this.alertLedger.filter(a => a.walletAddress.toLowerCase() === target);
  }

  /**
   * Clear in-memory alert history (useful for tests)
   */
  public clear(): void {
    this.alertLedger = [];
    this.lastAlerts.clear();
  }
}

export const alertSystemInstance = new AlertSystem();
