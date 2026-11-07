/**
 * Aave V3 on Base Protocol Client & Asset Introspection
 */

import { CONFIG, VERIFIED_RESERVES } from '../config/index.ts';
import type { UserAssetBalance } from '../types/index.ts';
import { PharosMcpClient } from '../mcp/pharosClients.ts';

export interface RawUserAccountData {
  totalCollateralBase: bigint;
  totalDebtBase: bigint;
  availableBorrowsBase: bigint;
  currentLiquidationThreshold: bigint;
  ltv: bigint;
  healthFactor: bigint;
  rawHex: string;
}

export class AaveV3BaseClient {
  private activeRpc: string;
  private mcpClient: PharosMcpClient;

  constructor(mcpClient?: PharosMcpClient) {
    this.activeRpc = CONFIG.BASE.PRIMARY_RPC;
    this.mcpClient = mcpClient || new PharosMcpClient();
  }

  /**
   * Execute JSON-RPC eth_call with automatic multi-RPC fallback
   */
  public async ethCall(to: string, data: string, from?: string): Promise<string> {
    const rpcs = [this.activeRpc, CONFIG.BASE.FALLBACK_RPC];
    let lastError: Error | null = null;

    for (const rpc of rpcs) {
      try {
        const payload: Record<string, unknown> = { to, data };
        if (from) payload.from = from;

        const res = await fetch(rpc, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            jsonrpc: '2.0',
            id: Date.now(),
            method: 'eth_call',
            params: [payload, 'latest'],
          }),
        });

        if (!res.ok) {
          throw new Error(`HTTP error ${res.status} from ${rpc}`);
        }

        const json = await res.json() as { result?: string; error?: { message: string } };
        if (json.error) {
          throw new Error(`RPC Error: ${json.error.message}`);
        }

        if (json.result !== undefined) {
          this.activeRpc = rpc; // lock into working rpc
          return json.result;
        }
      } catch (err: unknown) {
        lastError = err instanceof Error ? err : new Error(String(err));
      }
    }

    throw new Error(`All Base RPC endpoints failed. Last error: ${lastError?.message}`);
  }

  /**
   * Get latest block number on Base
   */
  public async getBlockNumber(): Promise<number> {
    const res = await fetch(this.activeRpc, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'eth_blockNumber', params: [] }),
    });
    const json = await res.json() as { result: string };
    return parseInt(json.result, 16);
  }

  /**
   * Query Pool.getUserAccountData(address)
   */
  public async getUserAccountData(userAddress: string): Promise<RawUserAccountData> {
    const cleanAddr = userAddress.toLowerCase().replace('0x', '').padStart(64, '0');
    const callData = CONFIG.SELECTORS.GET_USER_ACCOUNT_DATA + cleanAddr;

    const rawHex = await this.ethCall(CONFIG.BASE.AAVE_V3_POOL, callData);

    this.mcpClient.recordProvenance(
      `Aave V3 Base Pool.getUserAccountData for ${userAddress}`,
      'Base Mainnet (8453)',
      this.activeRpc,
      rawHex,
      callData
    );

    if (!rawHex || rawHex.length < 386) {
      throw new Error(`Invalid response length from getUserAccountData: ${rawHex}`);
    }

    return {
      totalCollateralBase: BigInt('0x' + rawHex.slice(2, 66)),
      totalDebtBase: BigInt('0x' + rawHex.slice(66, 130)),
      availableBorrowsBase: BigInt('0x' + rawHex.slice(130, 194)),
      currentLiquidationThreshold: BigInt('0x' + rawHex.slice(194, 258)),
      ltv: BigInt('0x' + rawHex.slice(258, 322)),
      healthFactor: BigInt('0x' + rawHex.slice(322, 386)),
      rawHex,
    };
  }

  /**
   * Query asset price from verified AaveOracle on Base
   */
  public async getAssetPrice(underlyingAddress: string): Promise<bigint> {
    const cleanAddr = underlyingAddress.toLowerCase().replace('0x', '').padStart(64, '0');
    const callData = CONFIG.SELECTORS.GET_ASSET_PRICE + cleanAddr;
    const rawHex = await this.ethCall(CONFIG.BASE.AAVE_ORACLE, callData);

    this.mcpClient.recordProvenance(
      `Aave Oracle getAssetPrice for ${underlyingAddress}`,
      'Base Mainnet (8453)',
      this.activeRpc,
      rawHex,
      callData
    );

    return BigInt(rawHex || '0x0');
  }

  /**
   * Query ERC20 balanceOf(address)
   */
  public async getBalanceOf(tokenAddress: string, userAddress: string): Promise<bigint> {
    const cleanAddr = userAddress.toLowerCase().replace('0x', '').padStart(64, '0');
    const callData = CONFIG.SELECTORS.BALANCE_OF + cleanAddr;
    const rawHex = await this.ethCall(tokenAddress, callData);
    return BigInt(rawHex || '0x0');
  }

  /**
   * Inspect all verified reserves and asset-level balances for a user
   */
  public async getUserAssetBreakdown(userAddress: string): Promise<UserAssetBalance[]> {
    const results: UserAssetBalance[] = [];

    for (const reserve of VERIFIED_RESERVES) {
      try {
        const [aBalRaw, dBalRaw, priceRaw] = await Promise.all([
          this.getBalanceOf(reserve.aTokenAddress, userAddress),
          this.getBalanceOf(reserve.variableDebtTokenAddress, userAddress),
          this.getAssetPrice(reserve.underlyingAddress),
        ]);

        const priceUSD = Number(priceRaw) / 1e8;
        const aUnits = Number(aBalRaw) / Math.pow(10, reserve.decimals);
        const dUnits = Number(dBalRaw) / Math.pow(10, reserve.decimals);

        // Value in base currency (USD 8 decimals):
        // Aave V3 applies half-up integer rounding: (bal * price + half) / 10^decimals
        const halfDivisor = (10n ** BigInt(reserve.decimals)) / 2n;
        const colBase = (aBalRaw * priceRaw + halfDivisor) / (10n ** BigInt(reserve.decimals));
        const debtBase = (dBalRaw * priceRaw + halfDivisor) / (10n ** BigInt(reserve.decimals));

        const collateralUSD = Number(colBase) / 1e8;
        const debtUSD = Number(debtBase) / 1e8;

        // Determine account-level collateral enablement:
        // If reserve LTV == 0 (like USDC), it cannot be enabled as collateral on Base
        const isEligible = reserve.isCollateralEligible;
        const hasCollateralBalance = aBalRaw > 0n;
        const hasDebt = dBalRaw > 0n;

        let statusLabel: UserAssetBalance['statusLabel'] = 'Inactive';
        let isAccountCollateralEnabled = false;

        if (hasDebt) {
          statusLabel = 'Active Debt';
        } else if (hasCollateralBalance) {
          if (isEligible) {
            statusLabel = 'Active Collateral';
            isAccountCollateralEnabled = true;
          } else {
            statusLabel = 'Yield-Only Deposit';
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
          statusLabel,
        });
      } catch (err: unknown) {
        console.warn(`Failed to introspect reserve ${reserve.symbol}:`, err);
      }
    }

    return results;
  }
}
