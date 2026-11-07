/**
 * Liquidation Watchdog - API Router & Request Handlers
 */

import { IncomingMessage, ServerResponse } from 'node:http';
import { URL } from 'node:url';
import { AaveV3BaseClient } from '../protocols/aaveV3Base.ts';
import { RiskEvaluator } from '../engine/riskEvaluator.ts';
import { alertSystemInstance } from '../engine/alertSystem.ts';
import { PharosMcpClient } from '../mcp/pharosClients.ts';
import { VERIFIED_RESERVES, CONFIG } from '../config/index.ts';

const EVM_ADDRESS_REGEX = /^0x[a-fA-F0-9]{40}$/;

export function sendJson(res: ServerResponse, statusCode: number, data: unknown): void {
  const jsonStr = JSON.stringify(data);
  res.writeHead(statusCode, {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Cache-Control': 'no-store, no-cache, must-revalidate',
  });
  res.end(jsonStr);
}

export async function parseJsonBody<T>(req: IncomingMessage): Promise<T> {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', chunk => {
      body += chunk;
      if (body.length > 1e6) { // 1MB limit
        reject(new Error('Request payload too large'));
      }
    });
    req.on('end', () => {
      try {
        if (!body.trim()) {
          resolve({} as T);
        } else {
          resolve(JSON.parse(body) as T);
        }
      } catch (err) {
        reject(new Error('Malformed JSON payload'));
      }
    });
    req.on('error', reject);
  });
}

export async function handleApiRequest(
  req: IncomingMessage,
  res: ServerResponse,
  pathname: string,
  urlObj: URL
): Promise<boolean> {
  if (req.method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    });
    res.end();
    return true;
  }

  // GET /api/health
  if (pathname === '/api/health' && req.method === 'GET') {
    sendJson(res, 200, {
      status: 'ok',
      service: 'Liquidation Watchdog',
      version: '1.0.0',
      timestamp: new Date().toISOString(),
      network: CONFIG.BASE.CHAIN_NAME,
      chainId: CONFIG.BASE.CHAIN_ID,
      poolAddress: CONFIG.BASE.AAVE_V3_POOL,
      pharosIntegration: {
        chainId: CONFIG.PHAROS.CHAIN_ID,
        docsMcp: CONFIG.PHAROS.DOCS_MCP_URL,
        chainMcp: CONFIG.PHAROS.CHAIN_MCP_URL,
      },
    });
    return true;
  }

  // GET /api/reserves
  if (pathname === '/api/reserves' && req.method === 'GET') {
    try {
      const client = new AaveV3BaseClient();
      const prices = await Promise.all(
        VERIFIED_RESERVES.map(async r => {
          try {
            const raw = await client.getAssetPrice(r.underlyingAddress);
            return { symbol: r.symbol, priceUSD: Number(raw) / 1e8 };
          } catch {
            return { symbol: r.symbol, priceUSD: 0 };
          }
        })
      );

      const reservesWithPrice = VERIFIED_RESERVES.map(r => {
        const found = prices.find(p => p.symbol === r.symbol);
        return {
          ...r,
          currentPriceUSD: found?.priceUSD || 0,
        };
      });

      sendJson(res, 200, { success: true, reserves: reservesWithPrice });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      sendJson(res, 500, { error: 'Failed to fetch reserves', details: msg });
    }
    return true;
  }

  // GET /api/alerts
  if (pathname === '/api/alerts' && req.method === 'GET') {
    const wallet = urlObj.searchParams.get('wallet') || undefined;
    const ledger = alertSystemInstance.getLedger(wallet);
    sendJson(res, 200, { success: true, alerts: ledger });
    return true;
  }

  // POST /api/watch
  if (pathname === '/api/watch' && req.method === 'POST') {
    try {
      interface WatchBody {
        walletAddress?: string;
        thresholds?: {
          warningThreshold?: number;
          criticalThreshold?: number;
          safetyTarget?: number;
        };
      }

      const body = await parseJsonBody<WatchBody>(req);
      const walletAddress = (body.walletAddress || '').trim().toLowerCase();

      if (!walletAddress || !EVM_ADDRESS_REGEX.test(walletAddress)) {
        sendJson(res, 400, {
          error: 'Invalid EVM wallet address',
          details: 'Address must be a 42-character hexadecimal string beginning with 0x.',
        });
        return true;
      }

      const mcpClient = new PharosMcpClient();
      const aaveClient = new AaveV3BaseClient(mcpClient);

      // Perform parallel on-chain reads
      const [blockNumber, rawData, assetBreakdown] = await Promise.all([
        aaveClient.getBlockNumber(),
        aaveClient.getUserAccountData(walletAddress),
        aaveClient.getUserAssetBreakdown(walletAddress),
      ]);

      // Deterministic risk evaluation
      const report = RiskEvaluator.evaluatePosition(
        walletAddress,
        rawData,
        blockNumber,
        assetBreakdown,
        body.thresholds,
        mcpClient
      );

      // Alert processing
      const newAlert = alertSystemInstance.processReport(report);
      const allAlerts = alertSystemInstance.getLedger(walletAddress);

      sendJson(res, 200, {
        success: true,
        report,
        latestAlert: newAlert,
        alertHistory: allAlerts,
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      sendJson(res, 500, {
        error: 'Failed to introspect lending position',
        details: msg,
      });
    }
    return true;
  }

  return false;
}
