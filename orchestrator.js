/**
 * orchestrator.js — AgentMarket Pro
 *
 * The master agent. Receives user queries, decides which specialist agents
 * to hire, pays them via x402 on Stellar, then synthesizes the final report.
 *
 * Payment flow:
 *   User → Orchestrator → Research Agent (pays 0.005 USDC)
 *                      → Research Agent → Data APIs (pays 0.001-0.002 USDC each)
 *                      → Writing Agent  (pays 0.003 USDC)
 *                      → Code Agent     (pays 0.004 USDC, if needed)
 */

import 'dotenv/config';
import * as StellarSdk from '@stellar/stellar-sdk';
import { x402Fetch } from './x402.js';
import readline from 'readline';

const BASE = `http://localhost:${process.env.PORT || 3001}`;

// Orchestrator's own Stellar keypair
const ORC_KP = StellarSdk.Keypair.fromSecret(process.env.ORCHESTRATOR_SECRET);

// Research agent's keypair (orchestrator controls it in this demo)
const RESEARCH_KP = StellarSdk.Keypair.fromSecret(process.env.RESEARCH_SECRET);

let sessionSpend = 0;
const spendLog = [];

// ── OpenRouter LLM call ───────────────────────────────────────────────────────

async function llm(messages, tools = null) {
  const body = {
    model: process.env.OPENROUTER_MODEL || 'meta-llama/llama-3.3-70b-instruct:free',
    max_tokens: 2048,
    messages,
  };
  if (tools) { body.tools = tools; body.tool_choice = 'auto'; }

  const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${process.env.OPENROUTER_API_KEY}`,
      'Content-Type': 'application/json',
      'HTTP-Referer': 'https://agentmarket.dev',
      'X-Title': 'AgentMarket',
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`LLM error: ${await res.text()}`);
  return res.json();
}

// ── Tool definitions ──────────────────────────────────────────────────────────

const TOOLS = [
  {
    type: 'function',
    function: {
      name: 'hire_research_agent',
      description: 'Hire the Research Agent to gather stock, news, and macro data. Costs 0.005 USDC.',
      parameters: {
        type: 'object',
        properties: {
          query: { type: 'string', description: 'The research question' },
          tickers: { type: 'array', items: { type: 'string' }, description: 'Stock tickers e.g. ["NVDA","AMD"]' },
        },
        required: ['query', 'tickers'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'hire_writing_agent',
      description: 'Hire the Writing Agent to turn raw data into a polished report. Costs 0.003 USDC.',
      parameters: {
        type: 'object',
        properties: {
          rawData: { type: 'object', description: 'Raw research data from the Research Agent' },
          style: { type: 'string', enum: ['professional', 'concise', 'detailed'], description: 'Report style' },
        },
        required: ['rawData'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'hire_code_agent',
      description: 'Hire the Code Agent to generate analysis scripts. Costs 0.004 USDC.',
      parameters: {
        type: 'object',
        properties: {
          task: { type: 'string', description: 'What code to generate' },
        },
        required: ['task'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'buy_stock_data',
      description: 'Directly buy stock data for a ticker. Costs 0.001 USDC per call.',
      parameters: {
        type: 'object',
        properties: {
          ticker: { type: 'string' },
        },
        required: ['ticker'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'buy_news_data',
      description: 'Directly buy news and sentiment data. Costs 0.001 USDC per call.',
      parameters: {
        type: 'object',
        properties: {
          query: { type: 'string' },
        },
        required: ['query'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'buy_macro_data',
      description: 'Buy macroeconomic indicators. Costs 0.002 USDC per call.',
      parameters: { type: 'object', properties: {}, required: [] },
    },
  },
];

// ── Tool execution ────────────────────────────────────────────────────────────

async function executeTool(name, args) {
  console.log(`\n  🔧 ${name}(${JSON.stringify(args).slice(0, 60)})`);

  switch (name) {
    case 'hire_research_agent': {
      const result = await x402Fetch(
        `${BASE}/agent/research`,
        ORC_KP,
        'orchestrator',
        { method: 'POST', body: JSON.stringify({ query: args.query, stockTickers: args.tickers }) }
      );
      sessionSpend += 0.005;
      spendLog.push({ action: 'hired research agent', cost: 0.005 });
      return result;
    }
    case 'hire_writing_agent': {
      const result = await x402Fetch(
        `${BASE}/agent/writing`,
        RESEARCH_KP,  // Research agent pays for writing
        'research-agent',
        { method: 'POST', body: JSON.stringify({ rawData: args.rawData, style: args.style || 'professional' }) }
      );
      sessionSpend += 0.003;
      spendLog.push({ action: 'hired writing agent', cost: 0.003 });
      return result;
    }
    case 'hire_code_agent': {
      const result = await x402Fetch(
        `${BASE}/agent/code`,
        ORC_KP,
        'orchestrator',
        { method: 'POST', body: JSON.stringify({ task: args.task }) }
      );
      sessionSpend += 0.004;
      spendLog.push({ action: 'hired code agent', cost: 0.004 });
      return result;
    }
    case 'buy_stock_data': {
      const result = await x402Fetch(`${BASE}/data/stock/${args.ticker}`, RESEARCH_KP, 'research-agent');
      sessionSpend += 0.001;
      spendLog.push({ action: `stock data ${args.ticker}`, cost: 0.001 });
      return result;
    }
    case 'buy_news_data': {
      const result = await x402Fetch(`${BASE}/data/news?q=${encodeURIComponent(args.query)}`, RESEARCH_KP, 'research-agent');
      sessionSpend += 0.001;
      spendLog.push({ action: `news data: ${args.query}`, cost: 0.001 });
      return result;
    }
    case 'buy_macro_data': {
      const result = await x402Fetch(`${BASE}/data/macro`, RESEARCH_KP, 'research-agent');
      sessionSpend += 0.002;
      spendLog.push({ action: 'macro data', cost: 0.002 });
      return result;
    }
    default:
      return { error: `Unknown tool: ${name}` };
  }
}

// ── Main agent loop ───────────────────────────────────────────────────────────

async function run(userQuery) {
  const startSpend = sessionSpend;

  console.log(`\n${'═'.repeat(58)}`);
  console.log(`🤖 ORCHESTRATOR — AgentMarket Pro`);
  console.log(`📝 Query: "${userQuery}"`);
  console.log(`💼 Wallet: ${ORC_KP.publicKey().slice(0, 20)}...`);
  console.log('═'.repeat(58));

  const messages = [
    {
      role: 'system',
      content: `You are the Orchestrator agent in AgentMarket Pro — a live AI agent economy built on Stellar.

You coordinate a team of specialist agents, each with their own Stellar wallet:
- Research Agent: gathers financial data (costs 0.005 USDC to hire)
- Writing Agent: polishes raw data into reports (costs 0.003 USDC to hire)  
- Code Agent: generates analysis scripts (costs 0.004 USDC to hire)

You can also buy data directly:
- Stock data: 0.001 USDC per ticker
- News data: 0.001 USDC per query
- Macro data: 0.002 USDC

Strategy: For complex research queries, hire the Research Agent (most efficient).
For simple queries, buy data directly. Always hire the Writing Agent at the end to polish the output.

Every payment is a real USDC transaction on Stellar testnet. Be efficient but thorough.`,
    },
    { role: 'user', content: userQuery },
  ];

  // Agentic loop
  while (true) {
    const response = await llm(messages, TOOLS);
    const choice = response.choices[0];
    const msg = choice.message;

    messages.push(msg);

    // Done
    if (choice.finish_reason === 'stop' || !msg.tool_calls?.length) {
      const text = msg.content || '';
      printReport(text, sessionSpend - startSpend);
      return text;
    }

    // Execute tool calls
    for (const call of msg.tool_calls) {
      let result;
      try {
        result = await executeTool(call.function.name, JSON.parse(call.function.arguments || '{}'));
      } catch (e) {
        console.error(`    ❌ Tool error: ${e.message}`);
        result = { error: e.message };
      }
      messages.push({ role: 'tool', tool_call_id: call.id, content: JSON.stringify(result) });
    }
  }
}

function printReport(text, spent) {
  console.log('\n' + '═'.repeat(58));
  console.log('📋 FINAL REPORT');
  console.log('═'.repeat(58));
  console.log(text);
  console.log('\n' + '─'.repeat(58));
  console.log(`💳 Session spend: ${spent.toFixed(4)} USDC`);
  console.log('Breakdown:');
  spendLog.forEach(e => console.log(`  ${e.action.padEnd(30)} ${e.cost.toFixed(4)} USDC`));
  console.log('─'.repeat(58) + '\n');
}

// ── CLI ───────────────────────────────────────────────────────────────────────

console.log(`
╔══════════════════════════════════════════════════╗
║      AgentMarket Pro — Orchestrator 🤖            ║
╠══════════════════════════════════════════════════╣
║  Coordinates: Research · Writing · Code agents    ║
║  Payments: USDC on Stellar (x402)                 ║
╚══════════════════════════════════════════════════╝

Try: "Compare NVDA vs AMD and write a full report"
     "Analyze TSLA with macro context"
     "What's the outlook for AI chip stocks?"
`);

const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
function prompt() {
  rl.question('\n🔍 Query > ', async (q) => {
    if (!q.trim() || q === 'exit') return process.exit(0);
    try { await run(q); } catch (e) { console.error('❌', e.message); }
    prompt();
  });
}
prompt();
