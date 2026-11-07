/**
 * Liquidation Watchdog - Frontend Application Logic
 *
 * Implements real-time Base Aave V3 position inspection, Active Browser Sentinel polling,
 * threshold alerts, recommendations rendering, and cryptographic provenance display.
 */

(function () {
  'use strict';

  // State
  const state = {
    wallet: '0xcbc3301782507d85e57db83d7d19db2a82478570',
    pollIntervalMs: 30000,
    pollTimer: null,
    countdownTimer: null,
    nextPollTarget: 0,
    lastObservedTimestamp: null,
    thresholds: {
      warningThreshold: 1.30,
      criticalThreshold: 1.10,
      safetyTarget: 1.50,
    },
    isLoading: false,
    alertsHistory: [],
  };

  // DOM Elements
  const el = {
    walletInput: document.getElementById('walletInput'),
    inspectBtn: document.getElementById('inspectBtn'),
    btnSpinner: document.getElementById('btnSpinner'),
    btnLabel: document.getElementById('btnLabel'),
    presetBorrowerBtn: document.getElementById('presetBorrowerBtn'),
    presetEmptyBtn: document.getElementById('presetEmptyBtn'),
    pollIntervalSelect: document.getElementById('pollIntervalSelect'),
    heartbeatDot: document.getElementById('heartbeatDot'),
    heartbeatText: document.getElementById('heartbeatText'),
    countdownText: document.getElementById('countdownText'),
    blockNumberText: document.getElementById('blockNumberText'),
    freshnessBadge: document.getElementById('freshnessBadge'),

    // Hero / Gauge
    hfNumber: document.getElementById('hfNumber'),
    riskStateBadge: document.getElementById('riskStateBadge'),
    hfMeterFill: document.getElementById('hfMeterFill'),
    hfStatusMessage: document.getElementById('hfStatusMessage'),

    // Metrics
    totalCollateralUSD: document.getElementById('totalCollateralUSD'),
    totalDebtUSD: document.getElementById('totalDebtUSD'),
    currentLtPct: document.getElementById('currentLtPct'),
    availableBorrowsUSD: document.getElementById('availableBorrowsUSD'),
    obsTimestamp: document.getElementById('obsTimestamp'),

    // Panels
    recommendationsContainer: document.getElementById('recommendationsContainer'),
    assetsTableBody: document.getElementById('assetsTableBody'),
    alertsLedger: document.getElementById('alertsLedger'),
    clearAlertsBtn: document.getElementById('clearAlertsBtn'),
    provenanceTableBody: document.getElementById('provenanceTableBody'),

    // Thresholds
    warnInput: document.getElementById('warnInput'),
    critInput: document.getElementById('critInput'),
    targetInput: document.getElementById('targetInput'),
    sumWarn: document.getElementById('sumWarn'),
    sumCrit: document.getElementById('sumCrit'),
    sumTarget: document.getElementById('sumTarget'),
    applyThresholdsBtn: document.getElementById('applyThresholdsBtn'),
    resetThresholdsBtn: document.getElementById('resetThresholdsBtn'),
  };

  const PRESET_BORROWER = '0xcbc3301782507d85e57db83d7d19db2a82478570';
  const PRESET_EMPTY = '0x0000000000000000000000000000000000000001';

  // Format currency
  function fmtUSD(num) {
    if (isNaN(num) || num === null) return '$0.00';
    return '$' + num.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }

  // Format token units
  function fmtTokens(num, maxDec = 4) {
    if (isNaN(num) || num === null) return '0';
    return num.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: maxDec });
  }

  // Set loading state
  function setLoading(loading) {
    state.isLoading = loading;
    if (loading) {
      el.btnSpinner.classList.remove('hidden');
      el.btnLabel.textContent = 'Querying Base...';
      el.inspectBtn.disabled = true;
      el.heartbeatDot.className = 'heartbeat-dot pulsing';
      el.heartbeatText.textContent = 'Querying Base RPC...';
    } else {
      el.btnSpinner.classList.add('hidden');
      el.btnLabel.textContent = 'Inspect Position';
      el.inspectBtn.disabled = false;
      if (state.pollIntervalMs > 0) {
        el.heartbeatDot.className = 'heartbeat-dot pulsing';
        el.heartbeatText.textContent = 'Sentinel Active';
      } else {
        el.heartbeatDot.className = 'heartbeat-dot idle';
        el.heartbeatText.textContent = 'Sentinel Idle';
      }
    }
  }

  // Perform inspection
  async function inspectPosition() {
    const rawAddr = el.walletInput.value.trim();
    if (!/^0x[a-fA-F0-9]{40}$/.test(rawAddr)) {
      alert('Please enter a valid 42-character EVM address (e.g. 0x...)');
      return;
    }

    state.wallet = rawAddr;
    setLoading(true);

    try {
      const res = await fetch('/api/watch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          walletAddress: state.wallet,
          thresholds: state.thresholds,
        }),
      });

      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        throw new Error(errJson.details || errJson.error || `HTTP ${res.status}`);
      }

      const data = await res.json();
      renderPosition(data.report);

      if (data.alertHistory) {
        state.alertsHistory = data.alertHistory;
        renderAlertsLedger(state.alertsHistory);
      }

      state.lastObservedTimestamp = Date.now();
      updateFreshnessBadge(true);
    } catch (err) {
      console.error('Inspection failed:', err);
      el.hfStatusMessage.textContent = `RPC Error: ${err.message}. Retrying on next poll cycle.`;
      el.freshnessBadge.className = 'badge badge-danger';
      el.freshnessBadge.textContent = 'RPC FAIL';
    } finally {
      setLoading(false);
      resetCountdown();
    }
  }

  // Render position report
  function renderPosition(rep) {
    if (!rep) return;

    // Block & observation info
    el.blockNumberText.textContent = rep.blockNumber.toLocaleString();
    el.obsTimestamp.textContent = new Date(rep.observationTimestamp).toUTCString();

    // Health factor & risk state
    const hf = rep.healthFactor;
    const hfStr = rep.healthFactorFormatted;
    const risk = rep.riskState;

    el.hfNumber.textContent = hfStr;
    el.hfNumber.className = 'hf-number';

    if (risk === 'HEALTHY') {
      el.riskStateBadge.className = 'badge badge-risk-healthy';
      el.riskStateBadge.textContent = 'HEALTHY';
      el.hfMeterFill.style.width = '100%';
    } else if (risk === 'WARNING') {
      el.riskStateBadge.className = 'badge badge-risk-warn';
      el.riskStateBadge.textContent = 'WARNING';
      el.hfNumber.classList.add('risk-warn');
      const pct = Math.min(100, Math.max(10, ((hf - 1.0) / (state.thresholds.warningThreshold - 1.0)) * 60 + 20));
      el.hfMeterFill.style.width = `${pct}%`;
    } else if (risk === 'CRITICAL') {
      el.riskStateBadge.className = 'badge badge-risk-crit';
      el.riskStateBadge.textContent = 'CRITICAL';
      el.hfNumber.classList.add('risk-crit');
      const pct = Math.min(40, Math.max(10, ((hf - 1.0) / 0.1) * 30 + 10));
      el.hfMeterFill.style.width = `${pct}%`;
    } else if (risk === 'LIQUIDATION RISK') {
      el.riskStateBadge.className = 'badge badge-danger';
      el.riskStateBadge.textContent = 'LIQUIDATION RISK';
      el.hfNumber.classList.add('risk-crit');
      el.hfMeterFill.style.width = '5%';
    }

    if (!rep.hasActiveDebt) {
      el.hfStatusMessage.textContent = 'Account has zero active borrowing debt. Liquidation risk is zero.';
    } else if (risk === 'HEALTHY') {
      el.hfStatusMessage.textContent = `Health Factor (${hfStr}) is safely above the warning threshold (${rep.thresholds.warningThreshold.toFixed(2)}).`;
    } else {
      el.hfStatusMessage.textContent = `ALERT: Health Factor (${hfStr}) is in ${risk} territory. Review remediation actions below.`;
    }

    // Metrics
    el.totalCollateralUSD.textContent = fmtUSD(rep.totalCollateralUSD);
    el.totalDebtUSD.textContent = fmtUSD(rep.totalDebtUSD);
    el.currentLtPct.textContent = `${rep.currentLiquidationThresholdPct.toFixed(2)}%`;
    el.availableBorrowsUSD.textContent = fmtUSD(rep.availableBorrowsUSD);

    // Render tables & recommendations
    renderRecommendations(rep.recommendations, rep.hasActiveDebt, rep.thresholds.safetyTarget);
    renderAssetsTable(rep.assetBreakdown);
    renderProvenanceTable(rep.provenance);
  }

  // Render recommendations panel
  function renderRecommendations(recs, hasDebt, targetHF) {
    if (!hasDebt) {
      el.recommendationsContainer.innerHTML = `
        <div class="empty-state">
          ✓ <strong>Optimal Position:</strong> Account holds no active debt on Base Aave V3. No repayment or collateral injection is required.
        </div>
      `;
      return;
    }

    if (!recs || recs.length === 0) {
      el.recommendationsContainer.innerHTML = `
        <div class="empty-state">
          ✓ <strong>Position Compliant:</strong> Health factor already satisfies or exceeds safety target (${targetHF.toFixed(2)}).
        </div>
      `;
      return;
    }

    let html = '';
    recs.forEach(rec => {
      if (rec.type === 'DEBT_REPAYMENT') {
        html += `
          <div class="rec-card rec-repay">
            <div class="rec-main">
              <div class="rec-tag">Recommended Remedy — Debt Repayment</div>
              <div class="rec-headline">Repay ~${fmtUSD(rec.requiredUSD)} (${fmtTokens(rec.requiredTokens)} ${rec.assetSymbol})</div>
              <div class="rec-explanation">${rec.explanation}</div>
            </div>
            <div class="rec-stat">
              <div class="rec-amount">${fmtUSD(rec.requiredUSD)}</div>
              <div class="rec-tokens">≈ ${fmtTokens(rec.requiredTokens)} ${rec.assetSymbol}</div>
            </div>
          </div>
        `;
      } else if (rec.type === 'COLLATERAL_ADDITION') {
        if (!rec.isEligible) {
          html += `
            <div class="rec-card rec-ineligible">
              <div class="rec-main">
                <div class="rec-tag">Protocol Invariant — Asset Ineligible</div>
                <div class="rec-headline">${rec.assetSymbol} Cannot Serve As Collateral (0% LTV)</div>
                <div class="rec-explanation">${rec.ineligibilityReason}</div>
              </div>
              <div class="rec-stat">
                <span class="badge badge-danger">INELIGIBLE</span>
              </div>
            </div>
          `;
        } else {
          html += `
            <div class="rec-card rec-collateral">
              <div class="rec-main">
                <div class="rec-tag">Recommended Remedy — Collateral Injection</div>
                <div class="rec-headline">Deposit ~${fmtUSD(rec.requiredUSD)} (${fmtTokens(rec.requiredTokens, 6)} ${rec.assetSymbol})</div>
                <div class="rec-explanation">${rec.explanation}</div>
              </div>
              <div class="rec-stat">
                <div class="rec-amount">${fmtUSD(rec.requiredUSD)}</div>
                <div class="rec-tokens">≈ ${fmtTokens(rec.requiredTokens, 6)} ${rec.assetSymbol}</div>
              </div>
            </div>
          `;
        }
      }
    });

    el.recommendationsContainer.innerHTML = html;
  }

  // Render assets breakdown
  function renderAssetsTable(assets) {
    if (!assets || assets.length === 0) {
      el.assetsTableBody.innerHTML = `<tr><td colspan="7" class="empty-cell">No assets discovered.</td></tr>`;
      return;
    }

    let html = '';
    assets.forEach(a => {
      let statusClass = 'status-inactive';
      if (a.statusLabel === 'Active Collateral') statusClass = 'status-active-collateral';
      else if (a.statusLabel === 'Yield-Only Deposit') statusClass = 'status-yield-only';
      else if (a.statusLabel === 'Active Debt') statusClass = 'status-active-debt';

      html += `
        <tr>
          <td><strong>${a.symbol}</strong></td>
          <td class="mono-value">${fmtTokens(a.aTokenBalanceUnits, 4)} ${a.symbol}</td>
          <td class="mono-value">${fmtTokens(a.variableDebtUnits, 4)} ${a.symbol}</td>
          <td class="mono-value">${fmtUSD(a.oraclePriceUSD)}</td>
          <td class="mono-value">${fmtUSD(a.collateralUSD)}</td>
          <td class="mono-value">${fmtUSD(a.debtUSD)}</td>
          <td>
            <span class="${statusClass}">${a.statusLabel}</span>
          </td>
        </tr>
      `;
    });

    el.assetsTableBody.innerHTML = html;
  }

  // Render alert ledger
  function renderAlertsLedger(alerts) {
    if (!alerts || alerts.length === 0) {
      el.alertsLedger.innerHTML = `<div class="empty-state">No alerts recorded yet in this session.</div>`;
      return;
    }

    let html = '';
    alerts.forEach(alt => {
      const timeStr = new Date(alt.timestamp).toLocaleTimeString();
      html += `
        <div class="alert-row alert-${alt.severity}">
          <div class="alert-meta">
            <span class="badge ${alt.severity === 'CRITICAL' ? 'badge-danger' : alt.severity === 'WARNING' ? 'badge-warning' : 'badge-success'}">${alt.severity}</span>
            <span class="alert-time">${timeStr}</span>
          </div>
          <div class="alert-body">
            <div class="alert-msg">${alt.message}</div>
            <div class="alert-action">→ ${alt.primaryActionSummary}</div>
          </div>
        </div>
      `;
    });

    el.alertsLedger.innerHTML = html;
  }

  // Render provenance trail
  function renderProvenanceTable(prov) {
    if (!prov || prov.length === 0) {
      el.provenanceTableBody.innerHTML = `<tr><td colspan="5" class="empty-cell">No provenance records available.</td></tr>`;
      return;
    }

    let html = '';
    prov.forEach(p => {
      const timeStr = new Date(p.timestamp).toLocaleTimeString();
      const shortHash = p.rawResponseSha256 ? `${p.rawResponseSha256.slice(0, 10)}...${p.rawResponseSha256.slice(-8)}` : '--';
      html += `
        <tr>
          <td>${p.step}</td>
          <td><span class="badge badge-network">${p.source}</span></td>
          <td class="mono-value">${p.endpoint}</td>
          <td class="mono-value" title="${p.rawResponseSha256}">${shortHash}</td>
          <td class="mono-value">${timeStr}</td>
        </tr>
      `;
    });

    el.provenanceTableBody.innerHTML = html;
  }

  // Active Browser Sentinel Polling Management
  function resetCountdown() {
    if (state.pollIntervalMs <= 0) {
      el.countdownText.textContent = 'OFF';
      return;
    }
    state.nextPollTarget = Date.now() + state.pollIntervalMs;
  }

  function tickCountdown() {
    // Check stale data (timeout > 120s)
    if (state.lastObservedTimestamp) {
      const elapsed = Date.now() - state.lastObservedTimestamp;
      if (elapsed > 120000) {
        el.freshnessBadge.className = 'badge badge-warning';
        el.freshnessBadge.textContent = 'STALE (>120s)';
      } else {
        el.freshnessBadge.className = 'badge badge-success';
        el.freshnessBadge.textContent = 'LIVE';
      }
    }

    if (state.pollIntervalMs <= 0 || !state.nextPollTarget) {
      el.countdownText.textContent = 'OFF';
      return;
    }

    const remainingMs = state.nextPollTarget - Date.now();
    if (remainingMs <= 0) {
      el.countdownText.textContent = 'Polling...';
      if (!state.isLoading) {
        inspectPosition();
      }
    } else {
      const sec = Math.ceil(remainingMs / 1000);
      el.countdownText.textContent = `${sec}s`;
    }
  }

  function setPollingInterval(ms) {
    state.pollIntervalMs = ms;
    if (ms <= 0) {
      el.heartbeatDot.className = 'heartbeat-dot idle';
      el.heartbeatText.textContent = 'Sentinel Idle';
      el.countdownText.textContent = 'OFF';
    } else {
      el.heartbeatDot.className = 'heartbeat-dot pulsing';
      el.heartbeatText.textContent = 'Sentinel Active';
      resetCountdown();
    }
  }

  function updateFreshnessBadge(isLive) {
    if (isLive) {
      el.freshnessBadge.className = 'badge badge-success';
      el.freshnessBadge.textContent = 'LIVE';
    } else {
      el.freshnessBadge.className = 'badge badge-danger';
      el.freshnessBadge.textContent = 'DISCONNECTED';
    }
  }

  // Event Listeners
  el.inspectBtn.addEventListener('click', () => inspectPosition());

  el.walletInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') inspectPosition();
  });

  el.presetBorrowerBtn.addEventListener('click', () => {
    el.walletInput.value = PRESET_BORROWER;
    inspectPosition();
  });

  el.presetEmptyBtn.addEventListener('click', () => {
    el.walletInput.value = PRESET_EMPTY;
    inspectPosition();
  });

  el.pollIntervalSelect.addEventListener('change', (e) => {
    const val = parseInt(e.target.value, 10);
    setPollingInterval(val);
  });

  el.applyThresholdsBtn.addEventListener('click', () => {
    const w = parseFloat(el.warnInput.value) || 1.30;
    const c = parseFloat(el.critInput.value) || 1.10;
    const t = parseFloat(el.targetInput.value) || 1.50;

    if (c >= w) {
      alert('Critical threshold must be strictly lower than Warning threshold.');
      return;
    }
    if (t <= w) {
      alert('Safety target must be higher than Warning threshold.');
      return;
    }

    state.thresholds.warningThreshold = w;
    state.thresholds.criticalThreshold = c;
    state.thresholds.safetyTarget = t;

    el.sumWarn.textContent = w.toFixed(2);
    el.sumCrit.textContent = c.toFixed(2);
    el.sumTarget.textContent = t.toFixed(2);

    inspectPosition();
  });

  el.resetThresholdsBtn.addEventListener('click', () => {
    el.warnInput.value = '1.30';
    el.critInput.value = '1.10';
    el.targetInput.value = '1.50';
    state.thresholds = { warningThreshold: 1.30, criticalThreshold: 1.10, safetyTarget: 1.50 };
    el.sumWarn.textContent = '1.30';
    el.sumCrit.textContent = '1.10';
    el.sumTarget.textContent = '1.50';
    inspectPosition();
  });

  el.clearAlertsBtn.addEventListener('click', () => {
    state.alertsHistory = [];
    renderAlertsLedger([]);
  });

  // Initialization
  state.countdownTimer = setInterval(tickCountdown, 1000);
  setPollingInterval(30000);

  // Initial fetch
  inspectPosition();
})();
