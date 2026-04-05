/**
 * server.js — AgentMarket Pro
 *
 * Runs two things:
 *  1. x402-protected DATA APIs  (stock, news, macro) — agents pay USDC to access
 *  2. x402-protected AGENT SERVICES (research, writing, code) — agents pay each other
 *
 * Every payment event is broadcast over WebSocket to the live dashboard.
 */

import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import http from 'http';
import { WebSocketServer } from 'ws';
import * as StellarSdk from '@stellar/stellar-sdk';
import { x402Middleware, verifyPayment } from './x402.js';

const app = express();
app.use(cors());
app.use(express.json());

// ── Wallets ───────────────────────────────────────────────────────────────────

const SERVER_KP  = StellarSdk.Keypair.fromSecret(process.env.SERVER_SECRET);
const SERVER_PUB = SERVER_KP.publicKey();

// Agent service wallets (agents register themselves as service providers)
const agentWallets = {
  research: process.env.RESEARCH_PUBLIC,
  writing:  process.env.WRITING_PUBLIC,
  code:     process.env.CODE_PUBLIC,
};

// ── WebSocket ─────────────────────────────────────────────────────────────────

const httpServer = http.createServer(app);
const wss = new WebSocketServer({ server: httpServer });
const clients = new Set();

wss.on('connection', ws => {
  clients.add(ws);
  ws.send(JSON.stringify({ type: 'connected', ts: Date.now() }));
  ws.on('close', () => clients.delete(ws));
});

export function broadcast(event) {
  const msg = JSON.stringify({ ...event, ts: Date.now() });
  for (const c of clients) if (c.readyState === 1) c.send(msg);
}

// ── Economy ledger (in-memory) ────────────────────────────────────────────────

const ledger = {
  transactions: [],
  agentBalances: { orchestrator: 0, research: 0, writing: 0, code: 0, server: 0 },
};

function recordTx(from, to, amount, service) {
  const tx = { from, to, amount, service, ts: Date.now() };
  ledger.transactions.unshift(tx);
  ledger.agentBalances[from] = (ledger.agentBalances[from] || 0) - amount;
  ledger.agentBalances[to]   = (ledger.agentBalances[to]   || 0) + amount;
  broadcast({ type: 'transaction', ...tx });
}

// ── Data API middleware helper ─────────────────────────────────────────────────

function dataMiddleware(price, name) {
  return x402Middleware(price, name, SERVER_PUB, broadcast);
}

// ── Mock data generators ──────────────────────────────────────────────────────

function stockData(ticker) {
  const base = { NVDA: 875, AMD: 142, TSLA: 248, AAPL: 189, MSFT: 415, GOOGL: 178 };
  const p = (base[ticker] || 100) + (Math.random() - 0.5) * 10;
  const ch = (Math.random() - 0.5) * 10;
  return { ticker, price: p.toFixed(2), change: ch.toFixed(2), changePct: ((ch/p)*100).toFixed(2), volume: Math.floor(Math.random()*50e6+10e6), pe: (Math.random()*40+15).toFixed(1), weekHigh: (p*1.35).toFixed(2), weekLow: (p*0.65).toFixed(2) };
}

function newsData(q) {
  const items = [
    { title: `${q} beats Q1 earnings estimates by 12%`, sentiment: 'bullish', source: 'Reuters' },
    { title: `Analysts raise ${q} price target on AI tailwinds`, sentiment: 'bullish', source: 'Bloomberg' },
    { title: `${q} expands data center partnerships with hyperscalers`, sentiment: 'bullish', source: 'WSJ' },
    { title: `Competition intensifies in ${q}'s core market`, sentiment: 'bearish', source: 'FT' },
    { title: `Institutional inflows into ${q} up 8% in latest 13F`, sentiment: 'bullish', source: 'SEC' },
  ];
  return { query: q, articles: items.slice(0, 4), sentiment: (Math.random()*0.4+0.4).toFixed(2) };
}

function macroData() {
  return { fedRate: '5.25-5.50%', cpi: '3.2%', gdp: '2.8%', vix: (14+Math.random()*8).toFixed(2), dxy: (103+Math.random()*2).toFixed(2), treasury10y: (4.2+Math.random()*0.3).toFixed(2)+'%' };
}

// ── DATA API Routes (server earns USDC) ──────────────────────────────────────

app.get('/data/stock/:ticker', dataMiddleware(0.001, 'stock-data'), (req, res) => {
  recordTx(req.payment.sender.slice(0,8), 'server', 0.001, 'stock-data');
  res.json({ ok: true, data: stockData(req.params.ticker.toUpperCase()) });
});

app.get('/data/news', dataMiddleware(0.001, 'news-feed'), (req, res) => {
  recordTx(req.payment.sender.slice(0,8), 'server', 0.001, 'news-feed');
  res.json({ ok: true, data: newsData(req.query.q || 'market') });
});

app.get('/data/macro', dataMiddleware(0.002, 'macro-data'), (req, res) => {
  recordTx(req.payment.sender.slice(0,8), 'server', 0.002, 'macro-data');
  res.json({ ok: true, data: macroData() });
});

// ── AGENT SERVICE Routes (agents earn USDC from each other) ──────────────────
//
// These are the agent-to-agent payment endpoints.
// Each specialist agent runs its logic here and gets paid via x402.

// Research Agent service: costs 0.005 USDC — does full data gathering
app.post('/agent/research', x402Middleware(0.005, 'research-agent', agentWallets.research, broadcast), async (req, res) => {
  const { query, stockTickers = [] } = req.body;
  recordTx('orchestrator', 'research', 0.005, 'research-agent');

  // Research agent itself pays for data (agent-to-agent chain)
  broadcast({ type: 'agent_working', agent: 'research', task: query });

  // Simulate data gathering (in production, research agent calls /data/* endpoints)
  const stocks = stockTickers.map(t => stockData(t));
  const news   = newsData(query);
  const macro  = macroData();

  res.json({ ok: true, data: { stocks, news, macro, query } });
});

// Writing Agent service: costs 0.003 USDC — polishes raw data into a report
app.post('/agent/writing', x402Middleware(0.003, 'writing-agent', agentWallets.writing, broadcast), async (req, res) => {
  const { rawData, style = 'professional' } = req.body;
  recordTx('research', 'writing', 0.003, 'writing-agent');
  broadcast({ type: 'agent_working', agent: 'writing', task: 'Polishing report...' });

  // Writing agent structures the report
  const report = {
    title: `Research Report: ${rawData?.query || 'Market Analysis'}`,
    sections: ['executive_summary', 'stock_analysis', 'news_sentiment', 'macro_context', 'outlook'],
    style,
    wordCount: 450,
    structured: true,
  };

  res.json({ ok: true, report });
});

// Code Agent service: costs 0.004 USDC — generates analysis scripts / visualizations
app.post('/agent/code', x402Middleware(0.004, 'code-agent', agentWallets.code, broadcast), async (req, res) => {
  const { task } = req.body;
  recordTx('orchestrator', 'code', 0.004, 'code-agent');
  broadcast({ type: 'agent_working', agent: 'code', task });

  const code = `# Auto-generated analysis\nimport pandas as pd\n\n# ${task}\ndf = pd.DataFrame(data)\nprint(df.describe())`;
  res.json({ ok: true, code, language: 'python' });
});

// ── Economy state (for dashboard) ────────────────────────────────────────────

app.get('/economy', (req, res) => {
  res.json({
    transactions: ledger.transactions.slice(0, 50),
    balances: ledger.agentBalances,
    agents: [
      { id: 'orchestrator', role: 'Orchestrator', wallet: process.env.ORCHESTRATOR_PUBLIC?.slice(0,8)+'...' },
      { id: 'research',     role: 'Research Agent', wallet: agentWallets.research?.slice(0,8)+'...' },
      { id: 'writing',      role: 'Writing Agent',  wallet: agentWallets.writing?.slice(0,8)+'...' },
      { id: 'code',         role: 'Code Agent',     wallet: agentWallets.code?.slice(0,8)+'...' },
      { id: 'server',       role: 'Data Server',    wallet: SERVER_PUB.slice(0,8)+'...' },
    ],
  });
});

// ── Agent query endpoint (triggered from dashboard) ──────────────────────────

app.post('/run', async (req, res) => {
  const { query } = req.body;
  if (!query) return res.status(400).json({ error: 'query required' });

  broadcast({ type: 'query_received', query });
  res.json({ ok: true, message: 'Query dispatched to orchestrator' });

  // Orchestrator picks it up via the broadcast — in production, this
  // would trigger the orchestrator process directly.
  setTimeout(() => {
    broadcast({ type: 'orchestrator_thinking', query });
  }, 500);
});

// ── Boot ──────────────────────────────────────────────────────────────────────

const PORT = process.env.PORT || 3001;
httpServer.listen(PORT, () => {
  console.log(`
╔══════════════════════════════════════════════════╗
║         AgentMarket Pro — Economy Server          ║
╠══════════════════════════════════════════════════╣
║  HTTP+WS  → http://localhost:${PORT}               ║
║  Server wallet → ${SERVER_PUB.slice(0, 24)}...   ║
╠══════════════════════════════════════════════════╣
║  DATA APIs (paid by agents):                      ║
║    GET /data/stock/:ticker   → 0.001 USDC         ║
║    GET /data/news?q=...      → 0.001 USDC         ║
║    GET /data/macro           → 0.002 USDC         ║
╠══════════════════════════════════════════════════╣
║  AGENT SERVICES (agent-to-agent):                 ║
║    POST /agent/research      → 0.005 USDC         ║
║    POST /agent/writing       → 0.003 USDC         ║
║    POST /agent/code          → 0.004 USDC         ║
╚══════════════════════════════════════════════════╝
`);
});
