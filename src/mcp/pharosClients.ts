/**
 * Pharos AI MCP Clients & Local SHA-256 Provenance Ledger
 */

import { createHash } from 'node:crypto';
import { CONFIG } from '../config/index.ts';
import type { ProvenanceRecord } from '../types/index.ts';

export function computeSha256(data: string | object): string {
  const str = typeof data === 'string' ? data : JSON.stringify(data);
  return createHash('sha256').update(str).digest('hex');
}

export class PharosMcpClient {
  public provenance: ProvenanceRecord[] = [];

  public recordProvenance(
    step: string,
    source: 'Base Mainnet (8453)' | 'Pharos Chain MCP (1672)' | 'Pharos Docs MCP' | 'Deterministic Risk Engine',
    endpoint: string,
    rawPayload: string | object,
    callData?: string
  ): ProvenanceRecord {
    const record: ProvenanceRecord = {
      step,
      source,
      endpoint,
      callData,
      rawResponseSha256: computeSha256(rawPayload),
      timestamp: new Date().toISOString(),
    };
    this.provenance.push(record);
    return record;
  }

  /**
   * Search Pharos developer docs for liquidation, oracle, or bridge specifications
   */
  public async searchDocs(query: string): Promise<string> {
    try {
      const res = await fetch(CONFIG.PHAROS.DOCS_MCP_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json, text/event-stream',
        },
        body: JSON.stringify({
          jsonrpc: '2.0',
          id: Date.now(),
          method: 'tools/call',
          params: {
            name: 'searchDocumentation',
            arguments: { query },
          },
        }),
      });

      if (!res.ok) {
        throw new Error(`Docs MCP returned HTTP ${res.status}`);
      }

      const text = await res.text();
      this.recordProvenance(
        `Pharos Docs MCP Query: "${query}"`,
        'Pharos Docs MCP',
        CONFIG.PHAROS.DOCS_MCP_URL,
        text
      );
      return text;
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      // Graceful fallback to embedded canonical knowledge
      const fallback = `Canonical documentation fallback for query "${query}": Pharos supports Supra/Chainlink price oracles and standard EVM liquidation mechanics.`;
      this.recordProvenance(
        `Pharos Docs MCP Query (Fallback): "${query}" - ${msg}`,
        'Pharos Docs MCP',
        CONFIG.PHAROS.DOCS_MCP_URL,
        fallback
      );
      return fallback;
    }
  }

  /**
   * Query Pharos Chain MCP for network status
   */
  public async getPharosChainInfo(): Promise<{ chainId: number; name: string }> {
    try {
      const res = await fetch(CONFIG.PHAROS.CHAIN_MCP_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json, text/event-stream',
        },
        body: JSON.stringify({
          jsonrpc: '2.0',
          id: 1,
          method: 'tools/call',
          params: { name: 'get_chain_info', arguments: {} },
        }),
      });

      const text = await res.text();
      this.recordProvenance(
        'Pharos Chain MCP Network Query',
        'Pharos Chain MCP (1672)',
        CONFIG.PHAROS.CHAIN_MCP_URL,
        text
      );
      return { chainId: CONFIG.PHAROS.CHAIN_ID, name: CONFIG.PHAROS.CHAIN_NAME };
    } catch {
      return { chainId: CONFIG.PHAROS.CHAIN_ID, name: CONFIG.PHAROS.CHAIN_NAME };
    }
  }
}
