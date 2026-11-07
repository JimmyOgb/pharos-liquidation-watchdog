// Vercel Serverless Function: /api/alerts


// src/api/alerts.ts
import { URL } from "node:url";

// src/config/index.ts
var CONFIG = {
  BASE: {
    CHAIN_ID: 8453,
    CHAIN_NAME: "Base Mainnet",
    PRIMARY_RPC: process.env.BASE_RPC_URL || "https://mainnet.base.org",
    FALLBACK_RPC: process.env.BASE_RPC_FALLBACK_URL || "https://1rpc.io/base",
    AAVE_V3_POOL: "0xA238Dd80C259a72e81d7e4664a9801593F98d1c5",
    AAVE_ORACLE: "0x2Cc0Fc26eD4563A5ce5e8bdcfe1A2878676Ae156"
  },
  PHAROS: {
    CHAIN_ID: 1672,
    CHAIN_NAME: "Pharos Pacific Mainnet",
    RPC_URL: process.env.PHAROS_RPC_URL || "https://rpc.pharos.xyz",
    CHAIN_MCP_URL: process.env.PHAROS_CHAIN_MCP_URL || "https://mcp.pharos.xyz/mcp",
    DOCS_MCP_URL: process.env.PHAROS_DOCS_MCP_URL || "https://docs.pharos.xyz/~gitbook/mcp"
  },
  THRESHOLDS: {
    DEFAULT_WARNING: 1.3,
    DEFAULT_CRITICAL: 1.1,
    DEFAULT_SAFETY_TARGET: 1.5
  },
  SELECTORS: {
    GET_USER_ACCOUNT_DATA: "0xbf92857c",
    // getUserAccountData(address)
    GET_ASSET_PRICE: "0xb3596f07",
    // getAssetPrice(address)
    BALANCE_OF: "0x70a08231",
    // balanceOf(address)
    SCALED_BALANCE_OF: "0x1da24f3e",
    // scaledBalanceOf(address)
    GET_RESERVES_LIST: "0xd1946dbc",
    // getReservesList()
    GET_RESERVE_DATA: "0x35ea6a75",
    // getReserveData(address)
    SET_USE_AS_COLLATERAL: "0x5a3b74b9"
    // setUserUseReserveAsCollateral(address,bool)
  },
  STALE_DATA_TIMEOUT_SECONDS: 120
};
var VERIFIED_RESERVES = [
  {
    symbol: "cbBTC",
    name: "Coinbase Wrapped BTC",
    underlyingAddress: "0xcbb7c0000ab88b473b1f5afd9ef808440eed33bf",
    aTokenAddress: "0xbdb9300b7cde636d9cd4aff00f6f009ffbbc8ee6",
    variableDebtTokenAddress: "0x05e08702028de6aad395dc6478b554a56920b9ad",
    decimals: 8,
    ltvBps: 8100,
    // 81.00%
    liquidationThresholdBps: 8400,
    // 84.00%
    liquidationBonusBps: 10600,
    // 106.00%
    isCollateralEligible: true,
    // LTV > 0
    isActive: true
  },
  {
    symbol: "WETH",
    name: "Wrapped Ether",
    underlyingAddress: "0x4200000000000000000000000000000000000006",
    aTokenAddress: "0xd4a0e0b9149bcee3c920d2e00b5de09138fd8bb7",
    variableDebtTokenAddress: "0x24e6e0795b3c7c71d965fcc4f371803d1c1dca1e",
    decimals: 18,
    ltvBps: 8100,
    // 81.00%
    liquidationThresholdBps: 8400,
    // 84.00%
    liquidationBonusBps: 10500,
    // 105.00%
    isCollateralEligible: true,
    // LTV > 0
    isActive: true
  },
  {
    symbol: "USDC",
    name: "USD Coin",
    underlyingAddress: "0x833589fcd6edb6e08f4c7c32d4f71b54bda02913",
    aTokenAddress: "0x4e65fe4dba92790696d040ac24aa414708f5c0ab",
    variableDebtTokenAddress: "0x59dca05b6c26dbd64b5381374aaac5cd05644c28",
    decimals: 6,
    ltvBps: 0,
    // 0.00% LTV (Governance disabled borrow margin)
    liquidationThresholdBps: 7800,
    // 78.00%
    liquidationBonusBps: 10500,
    // 105.00%
    isCollateralEligible: false,
    // INELIGIBLE (LTV == 0, setUserUseReserveAsCollateral reverts 0x21e5c4ae)
    isActive: true
  },
  {
    symbol: "cbETH",
    name: "Coinbase Wrapped Staked ETH",
    underlyingAddress: "0x2ae3f1ec7f1f5012cfeab0185bfc7aa3cf0dec22",
    aTokenAddress: "0x8a920272e5052adcfd1ba28d44ec6dbdf2d0e74b",
    variableDebtTokenAddress: "0x59714856f7efb0dd6478d8a7cba8b1c4b791010d",
    decimals: 18,
    ltvBps: 7500,
    // 75.00%
    liquidationThresholdBps: 7800,
    // 78.00%
    liquidationBonusBps: 10750,
    // 107.50%
    isCollateralEligible: true,
    // LTV > 0
    isActive: true
  },
  {
    symbol: "wstETH",
    name: "Wrapped Staked Ether",
    underlyingAddress: "0xc1cba3fcea344f92d9239c08c0568f6f2f0ee452",
    aTokenAddress: "0x04c0599ae5a44757c0af6f9ec3b93da8976c150a",
    variableDebtTokenAddress: "0x4db4e0b57e7cb28387ea310d7054a3952ba57161",
    decimals: 18,
    ltvBps: 7500,
    // 75.00%
    liquidationThresholdBps: 7800,
    // 78.00%
    liquidationBonusBps: 10750,
    // 107.50%
    isCollateralEligible: true,
    // LTV > 0
    isActive: true
  }
];

// src/mcp/pharosClients.ts
import { createHash } from "node:crypto";
function computeSha256(data) {
  const str = typeof data === "string" ? data : JSON.stringify(data);
  return createHash("sha256").update(str).digest("hex");
}
var PharosMcpClient = class {
  provenance = [];
  recordProvenance(step, source, endpoint, rawPayload, callData) {
    const record = {
      step,
      source,
      endpoint,
      callData,
      rawResponseSha256: computeSha256(rawPayload),
      timestamp: (/* @__PURE__ */ new Date()).toISOString()
    };
    this.provenance.push(record);
    return record;
  }
  /**
   * Search Pharos developer docs for liquidation, oracle, or bridge specifications
   */
  async searchDocs(query) {
    try {
      const res = await fetch(CONFIG.PHAROS.DOCS_MCP_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Accept": "application/json, text/event-stream"
        },
        body: JSON.stringify({
          jsonrpc: "2.0",
          id: Date.now(),
          method: "tools/call",
          params: {
            name: "searchDocumentation",
            arguments: { query }
          }
        })
      });
      if (!res.ok) {
        throw new Error(`Docs MCP returned HTTP ${res.status}`);
      }
      const text = await res.text();
      this.recordProvenance(
        `Pharos Docs MCP Query: "${query}"`,
        "Pharos Docs MCP",
        CONFIG.PHAROS.DOCS_MCP_URL,
        text
      );
      return text;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      const fallback = `Canonical documentation fallback for query "${query}": Pharos supports Supra/Chainlink price oracles and standard EVM liquidation mechanics.`;
      this.recordProvenance(
        `Pharos Docs MCP Query (Fallback): "${query}" - ${msg}`,
        "Pharos Docs MCP",
        CONFIG.PHAROS.DOCS_MCP_URL,
        fallback
      );
      return fallback;
    }
  }
  /**
   * Query Pharos Chain MCP for network status
   */
  async getPharosChainInfo() {
    try {
      const res = await fetch(CONFIG.PHAROS.CHAIN_MCP_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Accept": "application/json, text/event-stream"
        },
        body: JSON.stringify({
          jsonrpc: "2.0",
          id: 1,
          method: "tools/call",
          params: { name: "get_chain_info", arguments: {} }
        })
      });
      const text = await res.text();
      this.recordProvenance(
        "Pharos Chain MCP Network Query",
        "Pharos Chain MCP (1672)",
        CONFIG.PHAROS.CHAIN_MCP_URL,
        text
      );
      return { chainId: CONFIG.PHAROS.CHAIN_ID, name: CONFIG.PHAROS.CHAIN_NAME };
    } catch {
      return { chainId: CONFIG.PHAROS.CHAIN_ID, name: CONFIG.PHAROS.CHAIN_NAME };
    }
  }
};

// src/protocols/aaveV3Base.ts
var AaveV3BaseClient = class {
  activeRpc;
  mcpClient;
  constructor(mcpClient) {
    this.activeRpc = CONFIG.BASE.PRIMARY_RPC;
    this.mcpClient = mcpClient || new PharosMcpClient();
  }
  /**
   * Execute JSON-RPC eth_call with automatic multi-RPC fallback
   */
  async ethCall(to, data, from) {
    const rpcs = [this.activeRpc, CONFIG.BASE.FALLBACK_RPC];
    let lastError = null;
    for (const rpc of rpcs) {
      try {
        const payload = { to, data };
        if (from) payload.from = from;
        const res = await fetch(rpc, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            jsonrpc: "2.0",
            id: Date.now(),
            method: "eth_call",
            params: [payload, "latest"]
          })
        });
        if (!res.ok) {
          throw new Error(`HTTP error ${res.status} from ${rpc}`);
        }
        const json = await res.json();
        if (json.error) {
          throw new Error(`RPC Error: ${json.error.message}`);
        }
        if (json.result !== void 0) {
          this.activeRpc = rpc;
          return json.result;
        }
      } catch (err) {
        lastError = err instanceof Error ? err : new Error(String(err));
      }
    }
    throw new Error(`All Base RPC endpoints failed. Last error: ${lastError?.message}`);
  }
  /**
   * Get latest block number on Base
   */
  async getBlockNumber() {
    const res = await fetch(this.activeRpc, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "eth_blockNumber", params: [] })
    });
    const json = await res.json();
    return parseInt(json.result, 16);
  }
  /**
   * Query Pool.getUserAccountData(address)
   */
  async getUserAccountData(userAddress) {
    const cleanAddr = userAddress.toLowerCase().replace("0x", "").padStart(64, "0");
    const callData = CONFIG.SELECTORS.GET_USER_ACCOUNT_DATA + cleanAddr;
    const rawHex = await this.ethCall(CONFIG.BASE.AAVE_V3_POOL, callData);
    this.mcpClient.recordProvenance(
      `Aave V3 Base Pool.getUserAccountData for ${userAddress}`,
      "Base Mainnet (8453)",
      this.activeRpc,
      rawHex,
      callData
    );
    if (!rawHex || rawHex.length < 386) {
      throw new Error(`Invalid response length from getUserAccountData: ${rawHex}`);
    }
    return {
      totalCollateralBase: BigInt("0x" + rawHex.slice(2, 66)),
      totalDebtBase: BigInt("0x" + rawHex.slice(66, 130)),
      availableBorrowsBase: BigInt("0x" + rawHex.slice(130, 194)),
      currentLiquidationThreshold: BigInt("0x" + rawHex.slice(194, 258)),
      ltv: BigInt("0x" + rawHex.slice(258, 322)),
      healthFactor: BigInt("0x" + rawHex.slice(322, 386)),
      rawHex
    };
  }
  /**
   * Query asset price from verified AaveOracle on Base
   */
  async getAssetPrice(underlyingAddress) {
    const cleanAddr = underlyingAddress.toLowerCase().replace("0x", "").padStart(64, "0");
    const callData = CONFIG.SELECTORS.GET_ASSET_PRICE + cleanAddr;
    const rawHex = await this.ethCall(CONFIG.BASE.AAVE_ORACLE, callData);
    this.mcpClient.recordProvenance(
      `Aave Oracle getAssetPrice for ${underlyingAddress}`,
      "Base Mainnet (8453)",
      this.activeRpc,
      rawHex,
      callData
    );
    return BigInt(rawHex || "0x0");
  }
  /**
   * Query ERC20 balanceOf(address)
   */
  async getBalanceOf(tokenAddress, userAddress) {
    const cleanAddr = userAddress.toLowerCase().replace("0x", "").padStart(64, "0");
    const callData = CONFIG.SELECTORS.BALANCE_OF + cleanAddr;
    const rawHex = await this.ethCall(tokenAddress, callData);
    return BigInt(rawHex || "0x0");
  }
  /**
   * Inspect all verified reserves and asset-level balances for a user
   */
  async getUserAssetBreakdown(userAddress) {
    const results = [];
    for (const reserve of VERIFIED_RESERVES) {
      try {
        const [aBalRaw, dBalRaw, priceRaw] = await Promise.all([
          this.getBalanceOf(reserve.aTokenAddress, userAddress),
          this.getBalanceOf(reserve.variableDebtTokenAddress, userAddress),
          this.getAssetPrice(reserve.underlyingAddress)
        ]);
        const priceUSD = Number(priceRaw) / 1e8;
        const aUnits = Number(aBalRaw) / Math.pow(10, reserve.decimals);
        const dUnits = Number(dBalRaw) / Math.pow(10, reserve.decimals);
        const halfDivisor = 10n ** BigInt(reserve.decimals) / 2n;
        const colBase = (aBalRaw * priceRaw + halfDivisor) / 10n ** BigInt(reserve.decimals);
        const debtBase = (dBalRaw * priceRaw + halfDivisor) / 10n ** BigInt(reserve.decimals);
        const collateralUSD = Number(colBase) / 1e8;
        const debtUSD = Number(debtBase) / 1e8;
        const isEligible = reserve.isCollateralEligible;
        const hasCollateralBalance = aBalRaw > 0n;
        const hasDebt = dBalRaw > 0n;
        let statusLabel = "Inactive";
        let isAccountCollateralEnabled = false;
        if (hasDebt) {
          statusLabel = "Active Debt";
        } else if (hasCollateralBalance) {
          if (isEligible) {
            statusLabel = "Active Collateral";
            isAccountCollateralEnabled = true;
          } else {
            statusLabel = "Yield-Only Deposit";
            isAccountCollateralEnabled = false;
          }
        }
        results.push({
          symbol: reserve.symbol,
          underlyingAddress: reserve.underlyingAddress,
          decimals: reserve.decimals,
          aTokenBalanceRaw: aBalRaw.toString(),
          aTokenBalanceUnits: aUnits,
          variableDebtRaw: dBalRaw.toString(),
          variableDebtUnits: dUnits,
          oraclePriceUSD: priceUSD,
          collateralUSD,
          debtUSD,
          isAccountCollateralEnabled,
          statusLabel
        });
      } catch (err) {
        console.warn(`Failed to introspect reserve ${reserve.symbol}:`, err);
      }
    }
    return results;
  }
};

// src/engine/riskEvaluator.ts
var RiskEvaluator = class {
  /**
   * Classify risk state according to deterministic threshold hierarchy:
   * 1. No active debt -> HEALTHY
   * 2. HF <= 1.0 -> LIQUIDATION RISK
   * 3. HF <= criticalThreshold (default 1.10) -> CRITICAL
   * 4. HF <= warningThreshold (default 1.30) -> WARNING
   * 5. Otherwise -> HEALTHY
   */
  static classifyRisk(healthFactor, hasActiveDebt, thresholds) {
    if (!hasActiveDebt || healthFactor === Infinity || healthFactor === 0) {
      return "HEALTHY";
    }
    if (healthFactor <= 1) {
      return "LIQUIDATION RISK";
    }
    if (healthFactor <= thresholds.criticalThreshold) {
      return "CRITICAL";
    }
    if (healthFactor <= thresholds.warningThreshold) {
      return "WARNING";
    }
    return "HEALTHY";
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
  static calculateRepayment(totalCollateralUSD, totalDebtUSD, currentLiquidationThresholdBps, targetHF, debtAssetSymbol, debtAssetPriceUSD, debtAssetDecimals) {
    const ltFraction = currentLiquidationThresholdBps / 1e4;
    const maxSafeDebtUSD = targetHF > 0 ? totalCollateralUSD * ltFraction / targetHF : 0;
    const repaymentUSD = Math.max(0, totalDebtUSD - maxSafeDebtUSD);
    let requiredTokens = 0;
    let rawTokenUnits = "0";
    if (repaymentUSD > 0 && debtAssetPriceUSD > 0) {
      requiredTokens = repaymentUSD / debtAssetPriceUSD;
      const factor = Math.pow(10, debtAssetDecimals);
      const rawInt = BigInt(Math.floor(requiredTokens * factor));
      rawTokenUnits = rawInt.toString();
    }
    return {
      type: "DEBT_REPAYMENT",
      assetSymbol: debtAssetSymbol,
      targetHealthFactor: targetHF,
      requiredUSD: Number(repaymentUSD.toFixed(2)),
      requiredTokens: Number(requiredTokens.toFixed(6)),
      rawTokenUnits,
      tokenDecimals: debtAssetDecimals,
      explanation: repaymentUSD > 0 ? `Repaying approximately $${repaymentUSD.toFixed(2)} (${requiredTokens.toFixed(4)} ${debtAssetSymbol}) reduces total debt to $${maxSafeDebtUSD.toFixed(2)}, restoring Health Factor to safety target ${targetHF.toFixed(2)}.` : `Position debt is already within safety margin for target Health Factor ${targetHF.toFixed(2)}.`,
      isEligible: true,
      disclaimer: "ESTIMATE \u2014 NOT AN EXECUTABLE TRANSACTION"
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
  static calculateCollateralAddition(totalCollateralUSD, totalDebtUSD, currentLiquidationThresholdBps, targetHF, reserveSymbol, reservePriceUSD, reserveDecimals, reserveLtBps, isCollateralEligible) {
    if (!isCollateralEligible || reserveLtBps <= 0) {
      return {
        type: "COLLATERAL_ADDITION",
        assetSymbol: reserveSymbol,
        targetHealthFactor: targetHF,
        requiredUSD: 0,
        requiredTokens: 0,
        rawTokenUnits: "0",
        tokenDecimals: reserveDecimals,
        explanation: `${reserveSymbol} has 0% LTV on Base Aave V3 and cannot be enabled as collateral. Deposited ${reserveSymbol} earns yield only and does not protect position health factor.`,
        isEligible: false,
        ineligibilityReason: `${reserveSymbol} has 0% LTV on Base Aave V3. Calling setUserUseReserveAsCollateral reverts on-chain with UserHasAssetWithZeroLtv() (0x21e5c4ae).`,
        disclaimer: "ESTIMATE \u2014 NOT AN EXECUTABLE TRANSACTION"
      };
    }
    const currentLtFraction = currentLiquidationThresholdBps / 1e4;
    const assetLtFraction = reserveLtBps / 1e4;
    const currentWeightedCollateral = totalCollateralUSD * currentLtFraction;
    const requiredWeightedCollateral = totalDebtUSD * targetHF;
    const deficitUSD = Math.max(0, requiredWeightedCollateral - currentWeightedCollateral);
    const requiredCollateralUSD = deficitUSD / assetLtFraction;
    let requiredTokens = 0;
    let rawTokenUnits = "0";
    if (requiredCollateralUSD > 0 && reservePriceUSD > 0) {
      requiredTokens = requiredCollateralUSD / reservePriceUSD;
      const factor = Math.pow(10, reserveDecimals);
      const rawInt = BigInt(Math.ceil(requiredTokens * factor));
      rawTokenUnits = rawInt.toString();
    }
    return {
      type: "COLLATERAL_ADDITION",
      assetSymbol: reserveSymbol,
      targetHealthFactor: targetHF,
      requiredUSD: Number(requiredCollateralUSD.toFixed(2)),
      requiredTokens: Number(requiredTokens.toFixed(6)),
      rawTokenUnits,
      tokenDecimals: reserveDecimals,
      explanation: requiredCollateralUSD > 0 ? `Depositing approximately $${requiredCollateralUSD.toFixed(2)} (${requiredTokens.toFixed(4)} ${reserveSymbol} at ${(assetLtFraction * 100).toFixed(0)}% liquidation threshold) raises weighted collateral by $${deficitUSD.toFixed(2)}, restoring Health Factor to safety target ${targetHF.toFixed(2)}.` : `Position collateral is already sufficient for target Health Factor ${targetHF.toFixed(2)}.`,
      isEligible: true,
      disclaimer: "ESTIMATE \u2014 NOT AN EXECUTABLE TRANSACTION"
    };
  }
  /**
   * Produce comprehensive position evaluation report
   */
  static evaluatePosition(walletAddress, rawData, blockNumber, assetBreakdown, userThresholds = {}, mcpClient) {
    const thresholds = {
      warningThreshold: userThresholds.warningThreshold ?? CONFIG.THRESHOLDS.DEFAULT_WARNING,
      criticalThreshold: userThresholds.criticalThreshold ?? CONFIG.THRESHOLDS.DEFAULT_CRITICAL,
      safetyTarget: userThresholds.safetyTarget ?? CONFIG.THRESHOLDS.DEFAULT_SAFETY_TARGET
    };
    const totalCollateralUSD = Number(rawData.totalCollateralBase) / 1e8;
    const totalDebtUSD = Number(rawData.totalDebtBase) / 1e8;
    const availableBorrowsUSD = Number(rawData.availableBorrowsBase) / 1e8;
    const currentLtBps = Number(rawData.currentLiquidationThreshold);
    const currentLtPct = currentLtBps / 100;
    const ltvPct = Number(rawData.ltv) / 100;
    const hasActiveDebt = rawData.totalDebtBase > 0n;
    let healthFactor = Infinity;
    let healthFactorFormatted = "\u221E (No Debt)";
    if (hasActiveDebt) {
      healthFactor = Number(rawData.healthFactor) / 1e18;
      healthFactorFormatted = healthFactor.toFixed(4);
    }
    const riskState = this.classifyRisk(healthFactor, hasActiveDebt, thresholds);
    const isHealthy = riskState === "HEALTHY";
    const recommendations = [];
    if (hasActiveDebt && healthFactor < thresholds.safetyTarget) {
      const primaryDebtAsset = assetBreakdown.find((a) => a.debtUSD > 0) || assetBreakdown.find((a) => a.symbol === "USDC");
      const debtSymbol = primaryDebtAsset?.symbol || "USDC";
      const debtPrice = primaryDebtAsset?.oraclePriceUSD || 1;
      const debtDecimals = primaryDebtAsset?.decimals || 6;
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
      for (const reserve of VERIFIED_RESERVES) {
        const userAsset = assetBreakdown.find((a) => a.symbol === reserve.symbol);
        const priceUSD = userAsset?.oraclePriceUSD || 1;
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
        "Deterministic Risk Engine",
        "local://engine/riskEvaluator",
        {
          walletAddress,
          riskState,
          healthFactor,
          recommendationsCount: recommendations.length
        }
      );
    }
    return {
      walletAddress,
      network: CONFIG.BASE.CHAIN_NAME,
      chainId: CONFIG.BASE.CHAIN_ID,
      protocol: "Aave V3",
      blockNumber,
      observationTimestamp: (/* @__PURE__ */ new Date()).toISOString(),
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
      freshnessStatus: "LIVE"
    };
  }
};

// src/engine/alertSystem.ts
var AlertSystem = class {
  alertLedger = [];
  lastAlerts = /* @__PURE__ */ new Map();
  deduplicationWindowMs = 10 * 60 * 1e3;
  // 10 minutes
  /**
   * Process a position report and generate an alert if a threshold is crossed or meaningful change occurred
   */
  processReport(report) {
    const walletKey = report.walletAddress.toLowerCase();
    const lastState = this.lastAlerts.get(walletKey);
    const now = Date.now();
    const currentHF = report.healthFactor;
    const currentRisk = report.riskState;
    const prevRisk = lastState ? lastState.riskState : "HEALTHY";
    if (!lastState) {
      this.lastAlerts.set(walletKey, {
        riskState: currentRisk,
        healthFactor: currentHF,
        timestampMs: now
      });
      if (currentRisk !== "HEALTHY") {
        const alert2 = this.createAlert(
          report,
          "HEALTHY",
          currentRisk,
          currentRisk === "CRITICAL" || currentRisk === "LIQUIDATION RISK" ? "CRITICAL" : "WARNING"
        );
        this.alertLedger.unshift(alert2);
        return alert2;
      }
      return null;
    }
    const stateChanged = prevRisk !== currentRisk;
    const hfDelta = Math.abs(currentHF - lastState.healthFactor);
    const timeSinceLastAlert = now - lastState.timestampMs;
    if (!stateChanged && hfDelta < 0.01 && timeSinceLastAlert < this.deduplicationWindowMs) {
      return null;
    }
    let severity = "INFO";
    let shouldEmit = false;
    if (stateChanged) {
      shouldEmit = true;
      if (currentRisk === "LIQUIDATION RISK") {
        severity = "CRITICAL";
      } else if (currentRisk === "CRITICAL") {
        severity = "CRITICAL";
      } else if (currentRisk === "WARNING") {
        severity = "WARNING";
      } else if (currentRisk === "HEALTHY" && (prevRisk === "WARNING" || prevRisk === "CRITICAL" || prevRisk === "LIQUIDATION RISK")) {
        severity = "RECOVERY";
      }
    } else if (currentRisk !== "HEALTHY" && timeSinceLastAlert >= this.deduplicationWindowMs && hfDelta >= 0.01) {
      shouldEmit = true;
      severity = currentRisk === "LIQUIDATION RISK" || currentRisk === "CRITICAL" ? "CRITICAL" : "WARNING";
    }
    if (!shouldEmit) {
      return null;
    }
    const alert = this.createAlert(report, prevRisk, currentRisk, severity);
    this.alertLedger.unshift(alert);
    if (this.alertLedger.length > 200) {
      this.alertLedger.pop();
    }
    this.lastAlerts.set(walletKey, {
      riskState: currentRisk,
      healthFactor: currentHF,
      timestampMs: now
    });
    return alert;
  }
  /**
   * Format human-readable message and actionable summary
   */
  createAlert(report, prevRisk, currentRisk, severity) {
    const id = `alt_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const hfStr = report.healthFactorFormatted;
    let message = "";
    let primaryAction = "Monitor position status.";
    let triggeredThreshold = report.thresholds.warningThreshold;
    if (currentRisk === "LIQUIDATION RISK") {
      triggeredThreshold = 1;
      message = `CRITICAL ALERT: Health Factor ${hfStr} has dropped to or below 1.00. This position is subject to immediate liquidation!`;
    } else if (currentRisk === "CRITICAL") {
      triggeredThreshold = report.thresholds.criticalThreshold;
      message = `WARNING: Position crossed CRITICAL threshold (${report.thresholds.criticalThreshold.toFixed(2)}). Current Health Factor is ${hfStr}.`;
    } else if (currentRisk === "WARNING") {
      triggeredThreshold = report.thresholds.warningThreshold;
      message = `CAUTION: Position entered WARNING zone (${report.thresholds.warningThreshold.toFixed(2)}). Current Health Factor is ${hfStr}.`;
    } else if (severity === "RECOVERY") {
      triggeredThreshold = report.thresholds.safetyTarget;
      message = `RECOVERY: Health Factor restored to ${hfStr} (Safety target: ${report.thresholds.safetyTarget.toFixed(2)}). Position is HEALTHY.`;
      primaryAction = "No immediate action required.";
    }
    const firstAction = report.recommendations.find((r) => r.isEligible);
    if (firstAction && severity !== "RECOVERY") {
      primaryAction = firstAction.explanation;
    }
    return {
      id,
      timestamp: (/* @__PURE__ */ new Date()).toISOString(),
      walletAddress: report.walletAddress,
      previousRiskState: prevRisk,
      currentRiskState: currentRisk,
      healthFactor: report.healthFactor,
      triggeredThreshold,
      severity,
      message,
      primaryActionSummary: primaryAction
    };
  }
  /**
   * Return full or filtered alert ledger
   */
  getLedger(walletAddress) {
    if (!walletAddress) return [...this.alertLedger];
    const target = walletAddress.toLowerCase();
    return this.alertLedger.filter((a) => a.walletAddress.toLowerCase() === target);
  }
  /**
   * Clear in-memory alert history (useful for tests)
   */
  clear() {
    this.alertLedger = [];
    this.lastAlerts.clear();
  }
};
var alertSystemInstance = new AlertSystem();

// src/server/router.ts
var EVM_ADDRESS_REGEX = /^0x[a-fA-F0-9]{40}$/;
function sendJson(res, statusCode, data) {
  const jsonStr = JSON.stringify(data);
  res.writeHead(statusCode, {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Cache-Control": "no-store, no-cache, must-revalidate"
  });
  res.end(jsonStr);
}
async function parseJsonBody(req) {
  return new Promise((resolve, reject) => {
    let body = "";
    req.on("data", (chunk) => {
      body += chunk;
      if (body.length > 1e6) {
        reject(new Error("Request payload too large"));
      }
    });
    req.on("end", () => {
      try {
        if (!body.trim()) {
          resolve({});
        } else {
          resolve(JSON.parse(body));
        }
      } catch (err) {
        reject(new Error("Malformed JSON payload"));
      }
    });
    req.on("error", reject);
  });
}
async function handleApiRequest(req, res, pathname, urlObj) {
  if (req.method === "OPTIONS") {
    res.writeHead(204, {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type"
    });
    res.end();
    return true;
  }
  if (pathname === "/api/health" && req.method === "GET") {
    sendJson(res, 200, {
      status: "ok",
      service: "Liquidation Watchdog",
      version: "1.0.0",
      timestamp: (/* @__PURE__ */ new Date()).toISOString(),
      network: CONFIG.BASE.CHAIN_NAME,
      chainId: CONFIG.BASE.CHAIN_ID,
      poolAddress: CONFIG.BASE.AAVE_V3_POOL,
      pharosIntegration: {
        chainId: CONFIG.PHAROS.CHAIN_ID,
        docsMcp: CONFIG.PHAROS.DOCS_MCP_URL,
        chainMcp: CONFIG.PHAROS.CHAIN_MCP_URL
      }
    });
    return true;
  }
  if (pathname === "/api/reserves" && req.method === "GET") {
    try {
      const client = new AaveV3BaseClient();
      const prices = await Promise.all(
        VERIFIED_RESERVES.map(async (r) => {
          try {
            const raw = await client.getAssetPrice(r.underlyingAddress);
            return { symbol: r.symbol, priceUSD: Number(raw) / 1e8 };
          } catch {
            return { symbol: r.symbol, priceUSD: 0 };
          }
        })
      );
      const reservesWithPrice = VERIFIED_RESERVES.map((r) => {
        const found = prices.find((p) => p.symbol === r.symbol);
        return {
          ...r,
          currentPriceUSD: found?.priceUSD || 0
        };
      });
      sendJson(res, 200, { success: true, reserves: reservesWithPrice });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      sendJson(res, 500, { error: "Failed to fetch reserves", details: msg });
    }
    return true;
  }
  if (pathname === "/api/alerts" && req.method === "GET") {
    const wallet = urlObj.searchParams.get("wallet") || void 0;
    const ledger = alertSystemInstance.getLedger(wallet);
    sendJson(res, 200, { success: true, alerts: ledger });
    return true;
  }
  if (pathname === "/api/watch" && req.method === "POST") {
    try {
      const body = await parseJsonBody(req);
      const walletAddress = (body.walletAddress || "").trim().toLowerCase();
      if (!walletAddress || !EVM_ADDRESS_REGEX.test(walletAddress)) {
        sendJson(res, 400, {
          error: "Invalid EVM wallet address",
          details: "Address must be a 42-character hexadecimal string beginning with 0x."
        });
        return true;
      }
      const mcpClient = new PharosMcpClient();
      const aaveClient = new AaveV3BaseClient(mcpClient);
      const [blockNumber, rawData, assetBreakdown] = await Promise.all([
        aaveClient.getBlockNumber(),
        aaveClient.getUserAccountData(walletAddress),
        aaveClient.getUserAssetBreakdown(walletAddress)
      ]);
      const report = RiskEvaluator.evaluatePosition(
        walletAddress,
        rawData,
        blockNumber,
        assetBreakdown,
        body.thresholds,
        mcpClient
      );
      const newAlert = alertSystemInstance.processReport(report);
      const allAlerts = alertSystemInstance.getLedger(walletAddress);
      sendJson(res, 200, {
        success: true,
        report,
        latestAlert: newAlert,
        alertHistory: allAlerts
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      sendJson(res, 500, {
        error: "Failed to introspect lending position",
        details: msg
      });
    }
    return true;
  }
  return false;
}

// src/api/alerts.ts
async function handler(req, res) {
  const urlObj = new URL(req.url || "/api/alerts", `http://${req.headers.host || "localhost"}`);
  await handleApiRequest(req, res, "/api/alerts", urlObj);
}
export {
  handler as default
};
