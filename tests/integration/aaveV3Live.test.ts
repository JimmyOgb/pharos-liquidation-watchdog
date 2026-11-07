/**
 * Integration Tests - Live Base Aave V3 RPC & Pharos MCP Sentinel
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { AaveV3BaseClient } from '../../src/protocols/aaveV3Base.ts';
import { PharosMcpClient } from '../../src/mcp/pharosClients.ts';
import { CONFIG, VERIFIED_RESERVES } from '../../src/config/index.ts';

const BORROWER_FIXTURE = '0xcbc3301782507d85e57db83d7d19db2a82478570';
const EMPTY_WALLET_FIXTURE = '0x0000000000000000000000000000000000000001';

describe('AaveV3BaseClient - Live On-Chain Integration (Chain ID 8453)', () => {
  it('INT1: Retrieves current Base block number from live RPC', async () => {
    const client = new AaveV3BaseClient();
    const blockNum = await client.getBlockNumber();
    assert.ok(typeof blockNum === 'number');
    assert.ok(blockNum > 54000000, `Expected blockNumber > 54,000,000, got ${blockNum}`);
  });

  it('INT2: Reads verified borrower position from Aave V3 Pool', async () => {
    const mcpClient = new PharosMcpClient();
    const client = new AaveV3BaseClient(mcpClient);

    const data = await client.getUserAccountData(BORROWER_FIXTURE);

    assert.ok(data.totalCollateralBase > 0n, 'Expected positive totalCollateralBase');
    assert.ok(data.totalDebtBase > 0n, 'Expected positive totalDebtBase');
    assert.ok(data.currentLiquidationThreshold > 0n, 'Expected positive currentLiquidationThreshold');
    assert.ok(data.healthFactor > 0n, 'Expected positive healthFactor');

    // Verify SHA-256 provenance was recorded
    assert.ok(mcpClient.provenance.length > 0);
    const lastRec = mcpClient.provenance[mcpClient.provenance.length - 1];
    assert.equal(lastRec.source, 'Base Mainnet (8453)');
    assert.match(lastRec.rawResponseSha256, /^[a-f0-9]{64}$/);
  });

  it('INT3: Reads empty baseline wallet returning zero collateral and zero debt', async () => {
    const client = new AaveV3BaseClient();
    const data = await client.getUserAccountData(EMPTY_WALLET_FIXTURE);

    assert.equal(data.totalCollateralBase, 0n);
    assert.equal(data.totalDebtBase, 0n);
  });

  it('INT4: Introspects verified asset prices from Base AaveOracle', async () => {
    const client = new AaveV3BaseClient();

    const wethReserve = VERIFIED_RESERVES.find(r => r.symbol === 'WETH')!;
    const cbBtcReserve = VERIFIED_RESERVES.find(r => r.symbol === 'cbBTC')!;
    const usdcReserve = VERIFIED_RESERVES.find(r => r.symbol === 'USDC')!;

    const [wethPriceRaw, cbBtcPriceRaw, usdcPriceRaw] = await Promise.all([
      client.getAssetPrice(wethReserve.underlyingAddress),
      client.getAssetPrice(cbBtcReserve.underlyingAddress),
      client.getAssetPrice(usdcReserve.underlyingAddress),
    ]);

    const wethPriceUSD = Number(wethPriceRaw) / 1e8;
    const cbBtcPriceUSD = Number(cbBtcPriceRaw) / 1e8;
    const usdcPriceUSD = Number(usdcPriceRaw) / 1e8;

    assert.ok(wethPriceUSD > 1000, `Expected WETH price > $1000, got ${wethPriceUSD}`);
    assert.ok(cbBtcPriceUSD > 30000, `Expected cbBTC price > $30000, got ${cbBtcPriceUSD}`);
    assert.ok(usdcPriceUSD >= 0.90 && usdcPriceUSD <= 1.10, `Expected USDC price ~ $1.00, got ${usdcPriceUSD}`);
  });

  it('INT5: Queries Pharos Docs MCP with provenance logging', async () => {
    const mcpClient = new PharosMcpClient();
    const result = await mcpClient.searchDocs('liquidation risk oracle price');

    assert.ok(typeof result === 'string' && result.length > 0);
    const docRec = mcpClient.provenance.find(p => p.source === 'Pharos Docs MCP');
    assert.ok(docRec !== undefined);
    assert.match(docRec.rawResponseSha256, /^[a-f0-9]{64}$/);
  });
});
