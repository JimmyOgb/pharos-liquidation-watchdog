/**
 * Liquidation Watchdog - Standalone Local HTTP Server
 */

import { createServer, IncomingMessage, ServerResponse } from 'node:http';
import { readFileSync, existsSync, statSync } from 'node:fs';
import { join, extname } from 'node:path';
import { URL } from 'node:url';
import { handleApiRequest } from './router.ts';

const PORT = parseInt(process.env.PORT || '3000', 10);
const PUBLIC_DIR = join(process.cwd(), 'public');

const MIME_TYPES: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
};

function serveStatic(req: IncomingMessage, res: ServerResponse, pathname: string): boolean {
  let filePath = join(PUBLIC_DIR, pathname === '/' ? 'index.html' : pathname);

  if (!existsSync(filePath) || !statSync(filePath).isFile()) {
    filePath = join(PUBLIC_DIR, 'index.html');
    if (!existsSync(filePath)) return false;
  }

  try {
    const ext = extname(filePath).toLowerCase();
    const contentType = MIME_TYPES[ext] || 'application/octet-stream';
    const content = readFileSync(filePath);

    res.writeHead(200, {
      'Content-Type': contentType,
      'Cache-Control': 'no-cache',
    });
    res.end(content);
    return true;
  } catch {
    return false;
  }
}

export function startServer(port = PORT) {
  const server = createServer(async (req, res) => {
    try {
      const urlObj = new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`);
      const pathname = urlObj.pathname;

      if (pathname.startsWith('/api/')) {
        const handled = await handleApiRequest(req, res, pathname, urlObj);
        if (handled) return;
      }

      const staticServed = serveStatic(req, res, pathname);
      if (staticServed) return;

      res.writeHead(404, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Not Found' }));
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Internal Server Error', details: msg }));
    }
  });

  server.listen(port, () => {
    console.log(`[Liquidation Watchdog] Server running on http://localhost:${port}`);
    console.log(`[Liquidation Watchdog] Network: Base Mainnet (Chain ID 8453)`);
    console.log(`[Liquidation Watchdog] Protocol: Aave V3 (${process.env.BASE_AAVE_POOL || '0xA238Dd80C259a72e81d7e4664a9801593F98d1c5'})`);
  });

  return server;
}

if (process.argv[1]?.endsWith('server/index.ts') || process.argv[1]?.endsWith('server.js')) {
  startServer();
}
