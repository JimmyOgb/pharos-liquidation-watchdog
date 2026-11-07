# Deployment Guide — Vercel & Standalone Node.js

Liquidation Watchdog is designed for **100% turnkey deployment** with zero ongoing cloud costs ($0-first).

---

## 1. Vercel Serverless Deployment

The project is structured to deploy natively to Vercel as a hybrid Static Web App + Serverless Functions.

### File Structure for Vercel
- `public/`: Static frontend assets (`index.html`, `styles.css`, `app.js`).
- `api/`: Serverless edge endpoints (`health.ts`, `watch.ts`, `reserves.ts`, `alerts.ts`).
- `vercel.json`: URL rewrites and daily cron specification.

### Deployment Steps (When Authorized)
1. Install Vercel CLI (optional):
   ```bash
   npm i -g vercel
   ```
2. Link project and deploy:
   ```bash
   vercel
   ```
3. For production release:
   ```bash
   vercel --prod
   ```

### Vercel Hobby Limitations & Monitoring Disclosure
- **Serverless Execution Limit**: 10 seconds per execution (more than sufficient for on-chain `eth_call` queries which average 300–800ms).
- **Scheduled Cron Limits**: Vercel Hobby tier allows a maximum frequency of **once every 24 hours** (`0 0 * * *`).
- **Monitoring Model**: The application uses the **Active Browser Sentinel** pattern, which provides real-time 15s/30s/60s polling while the dashboard tab is open. Continuous background polling while the browser is closed is explicitly disclaimed.

---

## 2. Standalone Node.js Production Deployment

For continuous server execution or containerized environments (e.g. Docker, VPS):

1. **Build the production bundle**:
   ```bash
   npm run build
   ```
2. **Start the standalone server**:
   ```bash
   npm start
   ```
   By default, the server binds to port `3000` (`http://localhost:3000`).

3. **Custom Port Configuration**:
   ```bash
   PORT=8080 npm start
   ```

---

## 3. Environment Variables Reference

Copy `.env.example` to `.env` to override default RPC endpoints:

| Variable | Description | Default |
| :--- | :--- | :--- |
| `BASE_RPC_URL` | Primary Base Mainnet JSON-RPC endpoint | `https://mainnet.base.org` |
| `BASE_RPC_FALLBACK_URL` | Fallback Base Mainnet JSON-RPC endpoint | `https://1rpc.io/base` |
| `PHAROS_RPC_URL` | Pharos Pacific Mainnet RPC | `https://rpc.pharos.xyz` |
| `PHAROS_CHAIN_MCP_URL` | Pharos Chain Model Context Protocol endpoint | `https://mcp.pharos.xyz/mcp` |
| `PHAROS_DOCS_MCP_URL` | Pharos Developer Documentation MCP endpoint | `https://docs.pharos.xyz/~gitbook/mcp` |
| `PORT` | Local standalone server port | `3000` |
