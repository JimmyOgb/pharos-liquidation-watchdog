import type { IncomingMessage, ServerResponse } from 'node:http';
import { URL } from 'node:url';
import { handleApiRequest } from '../src/server/router.ts';

export default async function handler(req: IncomingMessage, res: ServerResponse) {
  const urlObj = new URL(req.url || '/api/watch', `http://${req.headers.host || 'localhost'}`);
  await handleApiRequest(req, res, '/api/watch', urlObj);
}
