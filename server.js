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

import yahooFinance from 'yahoo-finance2';

async function stockData(ticker) {
  const cryptoMap = {'BTC':'BTC-USD','ETH':'ETH-USD','SOL':'SOL-USD','BNB':'BNB-USD','XRP':'XRP-USD'};
  ticker = cryptoMap[ticker.toUpperCase()] || ticker;
  const q = await yahooFinance.quote(ticker);
  return {
    ticker,
    price: q.regularMarketPrice,
    change: q.regularMarketChange?.toFixed(2),
    changePct: q.regularMarketChangePercent?.toFixed(2),
    volume: q.regularMarketVolume,
    pe: q.trailingPE?.toFixed(1),
    weekHigh: q.fiftyTwoWeekHigh,
    weekLow: q.fiftyTwoWeekLow,
  };
}

async function newsData(q) {
  const results = await yahooFinance.search(q);
  const articles = (results.news || []).slice(0, 4).map(n => ({
    title: n.title,
    source: n.publisher,
    sentiment: 'neutral',
  }));
  return { query: q, articles, sentiment: '0.50' };
}

async function macroData() {
  const [vix, dxy, treasury] = await Promise.all([
    yahooFinance.quote('^VIX'),
    yahooFinance.quote('DX-Y.NYB'),
    yahooFinance.quote('^TNX'),
  ]);
  return {
    fedRate: '5.25-5.50%',
    cpi: '3.2%',
    gdp: '2.8%',
    vix: vix.regularMarketPrice?.toFixed(2),
    dxy: dxy.regularMarketPrice?.toFixed(2),
    treasury10y: treasury.regularMarketPrice?.toFixed(2) + '%',
  };
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
  const stocks = await Promise.all(stockTickers.map(t => stockData(t)));
  const news = await newsData(query);
  const macro = await macroData();
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

async function llm(messages) {
  const body = { 
    model: process.env.OPENROUTER_MODEL || 'nvidia/nemotron-3-super-120b-a12b:free', 
    max_tokens: 2048, 
    messages 
  };
  const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: { 
      'Authorization': `Bearer ${process.env.OPENROUTER_API_KEY}`, 
      'Content-Type': 'application/json', 
      'HTTP-Referer': 'https://agentmarket.dev', 
      'X-Title': 'AgentMarket' 
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`LLM error: ${await res.text()}`);
  return res.json();
}

function extractTickers(query) {
  const known = ['NVDA','AMD','TSLA','AAPL','MSFT','GOOGL','META','AMZN','BTC','ETH','SOL'];
  const upper = query.toUpperCase();
  return known.filter(t => upper.includes(t));
}

// Hardcoded chain — no LLM tool-calling loop, always runs Research → Writing → Report
async function runOrchestrator(query) {
  broadcast({ type: 'orchestrator_thinking', query });

  try {
    // Step 1: Pay Research Agent and get data
    broadcast({ type: 'agent_working', agent: 'research', task: query });
    const tickers = extractTickers(query);
    const researchResult = await x402Fetch(
      `${BASE}/agent/research`, 
      ORC_KP, 
      'orchestrator', 
      { method: 'POST', body: JSON.stringify({ query, stockTickers: tickers }) }
    );

    const researchData = researchResult?.data || researchResult;

    // Step 2: Pay Writing Agent with the research data
    broadcast({ type: 'agent_working', agent: 'writing', task: 'Polishing report...' });
    await x402Fetch(
      `${BASE}/agent/writing`, 
      RESEARCH_KP, 
      'research-agent', 
      { method: 'POST', body: JSON.stringify({ rawData: researchData, style: 'professional' }) }
    );

    // Step 3: LLM writes the final report from the collected data
    const response = await llm([
      { 
        role: 'system', 
        content: 'You are a professional financial analyst. Write a detailed, well-structured research report. Include: executive summary, stock analysis with key metrics, news sentiment analysis, macroeconomic context, and investment outlook. Be specific and data-driven.' 
      },
      { 
        role: 'user', 
        content: `Write a comprehensive research report for: "${query}"\n\nData collected:\n${JSON.stringify(researchData, null, 2)}` 
      }
    ]);

    const report = response.choices[0].message.content || 'Report generation failed.';
    broadcast({ type: 'report_ready', query, report });

  } catch (e) {
    console.error('Orchestrator error:', e.message);
    broadcast({ type: 'error', message: e.message });
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