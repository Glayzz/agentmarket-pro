/**
 * server.js — AgentMarket Pro
 * Full orchestrator built-in — dashboard queries trigger real agent payments
 */

import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import http from 'http';
import { WebSocketServer } from 'ws';
import * as StellarSdk from '@stellar/stellar-sdk';
import { x402Middleware, x402Fetch } from './x402.js';

const app = express();
app.use(cors());
app.use(express.json());

const SERVER_KP   = StellarSdk.Keypair.fromSecret(process.env.SERVER_SECRET);
const SERVER_PUB  = SERVER_KP.publicKey();
const ORC_KP      = StellarSdk.Keypair.fromSecret(process.env.ORCHESTRATOR_SECRET);
const RESEARCH_KP = StellarSdk.Keypair.fromSecret(process.env.RESEARCH_SECRET);

const agentWallets = {
  research: process.env.RESEARCH_PUBLIC,
  writing:  process.env.WRITING_PUBLIC,
  code:     process.env.CODE_PUBLIC,
};

const BASE = process.env.RAILWAY_PUBLIC_DOMAIN 
  ? `https://${process.env.RAILWAY_PUBLIC_DOMAIN}` 
  : `http://localhost:${process.env.PORT || 8080}`;

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

const ledger = {
  transactions: [],
  agentBalances: { orchestrator: 0, research: 0, writing: 0, code: 0, server: 0 },
};

function recordTx(from, to, amount, service, txHash = null) {
  const tx = { from, to, amount, service, txHash, ts: Date.now() };
  ledger.transactions.unshift(tx);
  ledger.agentBalances[from] = (ledger.agentBalances[from] || 0) - amount;
  ledger.agentBalances[to]   = (ledger.agentBalances[to]   || 0) + amount;
  broadcast({ type: 'transaction', ...tx });
}

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

function dataMiddleware(price, name) {
  return x402Middleware(price, name, SERVER_PUB, broadcast);
}

app.get('/data/stock/:ticker', dataMiddleware(0.001, 'stock-data'), (req, res) => {
  recordTx(req.payment.sender.slice(0,8), 'server', 0.001, 'stock-data', req.payment.txHash);
  res.json({ ok: true, data: stockData(req.params.ticker.toUpperCase()) });
});

app.get('/data/news', dataMiddleware(0.001, 'news-feed'), (req, res) => {
  recordTx(req.payment.sender.slice(0,8), 'server', 0.001, 'news-feed', req.payment.txHash);
  res.json({ ok: true, data: newsData(req.query.q || 'market') });
});

app.get('/data/macro', dataMiddleware(0.002, 'macro-data'), (req, res) => {
  recordTx(req.payment.sender.slice(0,8), 'server', 0.002, 'macro-data', req.payment.txHash);
  res.json({ ok: true, data: macroData() });
});

app.post('/agent/research', x402Middleware(0.005, 'research-agent', agentWallets.research, broadcast), async (req, res) => {
  const { query, stockTickers = [] } = req.body;
  recordTx('orchestrator', 'research', 0.005, 'research-agent', req.payment.txHash);
  broadcast({ type: 'agent_working', agent: 'research', task: query });
  const stocks = stockTickers.map(t => stockData(t));
  const news   = newsData(query);
  const macro  = macroData();
  res.json({ ok: true, data: { stocks, news, macro, query } });
});

app.post('/agent/writing', x402Middleware(0.003, 'writing-agent', agentWallets.writing, broadcast), async (req, res) => {
  const { rawData, style = 'professional' } = req.body;
  recordTx('research', 'writing', 0.003, 'writing-agent', req.payment.txHash);
  broadcast({ type: 'agent_working', agent: 'writing', task: 'Polishing report...' });
  const report = { title: `Research Report: ${rawData?.query || 'Market Analysis'}`, sections: ['executive_summary','stock_analysis','news_sentiment','macro_context','outlook'], style, wordCount: 450, structured: true };
  res.json({ ok: true, report });
});

app.post('/agent/code', x402Middleware(0.004, 'code-agent', agentWallets.code, broadcast), async (req, res) => {
  const { task } = req.body;
  recordTx('orchestrator', 'code', 0.004, 'code-agent', req.payment.txHash);
  broadcast({ type: 'agent_working', agent: 'code', task });
  const code = `# Auto-generated analysis\nimport pandas as pd\n\n# ${task}\ndf = pd.DataFrame(data)\nprint(df.describe())`;
  res.json({ ok: true, code, language: 'python' });
});

async function llm(messages, tools = null) {
  const body = { model: process.env.OPENROUTER_MODEL || 'meta-llama/llama-3.3-70b-instruct:free', max_tokens: 2048, messages };
  if (tools) { body.tools = tools; body.tool_choice = 'auto'; }
  const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${process.env.OPENROUTER_API_KEY}`, 'Content-Type': 'application/json', 'HTTP-Referer': 'https://agentmarket.dev', 'X-Title': 'AgentMarket' },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`LLM error: ${await res.text()}`);
  return res.json();
}

const TOOLS = [
  { type: 'function', function: { name: 'hire_research_agent', description: 'Hire Research Agent. Costs 0.005 USDC.', parameters: { type: 'object', properties: { query: { type: 'string' }, tickers: { type: 'array', items: { type: 'string' } } }, required: ['query','tickers'] } } },
  { type: 'function', function: { name: 'hire_writing_agent', description: 'Hire Writing Agent. Costs 0.003 USDC.', parameters: { type: 'object', properties: { rawData: { type: 'object' }, style: { type: 'string', enum: ['professional','concise','detailed'] } }, required: ['rawData'] } } },
  { type: 'function', function: { name: 'buy_stock_data', description: 'Buy stock data. Costs 0.001 USDC.', parameters: { type: 'object', properties: { ticker: { type: 'string' } }, required: ['ticker'] } } },
  { type: 'function', function: { name: 'buy_news_data', description: 'Buy news data. Costs 0.001 USDC.', parameters: { type: 'object', properties: { query: { type: 'string' } }, required: ['query'] } } },
  { type: 'function', function: { name: 'buy_macro_data', description: 'Buy macro data. Costs 0.002 USDC.', parameters: { type: 'object', properties: {} } } },
];

async function executeTool(name, args) {
  switch (name) {
    case 'hire_research_agent': return x402Fetch(`${BASE}/agent/research`, ORC_KP, 'orchestrator', { method: 'POST', body: JSON.stringify({ query: args.query, stockTickers: args.tickers }) });
    case 'hire_writing_agent': return x402Fetch(`${BASE}/agent/writing`, RESEARCH_KP, 'research-agent', { method: 'POST', body: JSON.stringify({ rawData: args.rawData, style: args.style || 'professional' }) });
    case 'buy_stock_data': return x402Fetch(`${BASE}/data/stock/${args.ticker}`, RESEARCH_KP, 'research-agent');
    case 'buy_news_data': return x402Fetch(`${BASE}/data/news?q=${encodeURIComponent(args.query)}`, RESEARCH_KP, 'research-agent');
    case 'buy_macro_data': return x402Fetch(`${BASE}/data/macro`, RESEARCH_KP, 'research-agent');
    default: return { error: `Unknown tool: ${name}` };
  }
}

async function runOrchestrator(query) {
  broadcast({ type: 'orchestrator_thinking', query });
  const messages = [
    { role: 'system', content: `You are the Orchestrator agent in AgentMarket Pro — a live AI agent economy on Stellar. Coordinate specialist agents to answer user queries. For complex financial queries, hire the Research Agent then the Writing Agent. Every tool call is a real USDC payment on Stellar testnet.` },
    { role: 'user', content: query },
  ];
  while (true) {
    const response = await llm(messages, TOOLS);
    const choice = response.choices[0];
    const msg = choice.message;
    messages.push(msg);
    if (choice.finish_reason === 'stop' || !msg.tool_calls?.length) {
      broadcast({ type: 'report_ready', query, report: msg.content || '' });
      return;
    }
    for (const call of msg.tool_calls) {
      let result;
      try { result = await executeTool(call.function.name, JSON.parse(call.function.arguments || '{}')); }
      catch (e) { result = { error: e.message }; }
      messages.push({ role: 'tool', tool_call_id: call.id, content: JSON.stringify(result) });
    }
  }
}

app.post('/run', async (req, res) => {
  const { query } = req.body;
  if (!query) return res.status(400).json({ error: 'query required' });
  broadcast({ type: 'query_received', query });
  res.json({ ok: true, message: 'Orchestrator started' });
  runOrchestrator(query).catch(e => broadcast({ type: 'error', message: e.message }));
});

app.get('/economy', (req, res) => {
  res.json({
    transactions: ledger.transactions.slice(0, 50),
    balances: ledger.agentBalances,
    agents: [
      { id: 'orchestrator', role: 'Orchestrator',   wallet: process.env.ORCHESTRATOR_PUBLIC?.slice(0,8)+'...' },
      { id: 'research',     role: 'Research Agent', wallet: agentWallets.research?.slice(0,8)+'...' },
      { id: 'writing',      role: 'Writing Agent',  wallet: agentWallets.writing?.slice(0,8)+'...' },
      { id: 'code',         role: 'Code Agent',     wallet: agentWallets.code?.slice(0,8)+'...' },
      { id: 'server',       role: 'Data Server',    wallet: SERVER_PUB.slice(0,8)+'...' },
    ],
  });
});

app.get('/health', (req, res) => res.json({ status: 'ok' }));

const PORT = process.env.PORT || 8080;
httpServer.listen(PORT, '0.0.0.0', () => {
  console.log(`AgentMarket Pro running on port ${PORT}`);
  console.log(`USDC_ISSUER: "${process.env.USDC_ISSUER}"`);
});
