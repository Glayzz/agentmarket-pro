# AgentMarket Pro ⚡

> A live AI agent economy where autonomous agents hire each other and pay in real USDC via the x402 protocol on Stellar.

**Built for Stellar Hacks: Agents — x402 + Stripe MPP Track**  
**Built by [Glayzz](https://github.com/Glayzz)**

🌐 **Live Demo:** [agent-market.netlify.app](https://agent-market.netlify.app)  
📊 **Dashboard:** [agent-market.netlify.app/dashboard.html](https://agent-market.netlify.app/app.html)  
🔗 **Verify on-chain:** [Stellar Testnet Explorer](https://stellar.expert/explorer/testnet)

---

## The Problem

AI agents can reason, plan, and act — but they hit a wall the moment they need to pay for something. Every existing solution requires a human to set up billing, manage API keys, or approve transactions. That's not autonomous. That's a human with extra steps.

---

## What I Built

AgentMarket Pro is a **live agent economy** on Stellar. Agents don't just call APIs — they autonomously hire other agents and settle payments in USDC via the x402 protocol. No human touches a wallet at any point.

```
User Query
    │
    ▼
🤖 Orchestrator Agent
    │
    ├── pays 0.005 USDC ──► 🔬 Research Agent
    │                           │
    │                           ├── pays 0.001 USDC ──► 📊 Stock Data API
    │                           ├── pays 0.001 USDC ──► 📰 News Feed API
    │                           └── pays 0.002 USDC ──► 📈 Macro Data API
    │
    └── pays 0.003 USDC ──► ✍️ Writing Agent
                                │
                                └── returns polished research report
```

Every arrow is a **real USDC transaction on Stellar testnet**, settled in under 5 seconds. Each transaction has a hash you can verify live on Stellar Explorer.

---

## How x402 Works

The x402 protocol turns HTTP into a payment channel. Here's the exact flow:

```
Agent                    Server                   Stellar
  │                        │                         │
  │── GET /data/stock ─────►│                         │
  │◄── 402 + instructions ──│                         │
  │    price: 0.001 USDC    │                         │
  │                         │                         │
  │────── pay USDC ──────────────────────────────────►│
  │◄───── txHash ────────────────────────────────────│
  │                         │                         │
  │── GET /data/stock ──────►│                         │
  │   X-Payment: <proof>    │── verify on Stellar ───►│
  │◄── 200 + data ───────────│◄── confirmed ───────────│
```

1. Agent requests a service endpoint
2. Server responds with **HTTP 402 Payment Required** + Stellar payment instructions
3. Agent automatically pays USDC on Stellar — **no human approval needed**
4. Agent retries with the transaction hash as the `X-Payment` header
5. Server verifies on-chain and serves the response

---

## Why Stellar

| Requirement | Stellar | Why it matters |
|---|---|---|
| Settlement speed | Under 5 seconds | x402 is synchronous HTTP — the agent waits for confirmation |
| Transaction fee | ~$0.00001 | Micropayments of $0.001 are economically viable |
| Stablecoin | Native USDC | No bridging, no wrapping, no slippage |
| Finality | Deterministic | No reorgs — payment proof is always valid |

---

## Features

- **Agent-to-agent payments** — Orchestrator hires Research Agent, Research Agent hires Writing Agent. A full payment chain, zero human involvement.
- **x402 on Stellar** — Every API call is a real USDC micropayment verified on-chain.
- **Live economy dashboard** — Animated payment flow, per-agent balance tracking, real-time event feed, on-chain tx hash links.
- **5 autonomous wallets** — Each agent has its own Stellar keypair and earns/spends independently.
- **Orchestrator baked into server** — Type a query in the dashboard and the full agent payment chain fires automatically. No separate process needed.
- **On-chain proof** — Every transaction in the dashboard links directly to Stellar Explorer so you can verify the payment yourself.
- **Mobile ready** — Fully responsive. Works on any device.
- **Free AI** — Powered by OpenRouter (Llama 3.3 70B), no paid API key required.

---

## Project Structure

```
agentmarket-pro/
├── server.js          — Express server + WebSocket + x402 API + built-in orchestrator
├── orchestrator.js    — Standalone orchestrator CLI (optional, for local testing)
├── x402.js            — Shared payment utilities (pay, verify, middleware)
├── setup-stellar.js   — One-command wallet generation and testnet funding
├── index.html         — Landing page
├── dashboard.html     — Live economy dashboard (mobile-responsive)
├── check-balances.js  — Utility to check all 5 wallet balances
├── .env.example       — Environment config template
├── railway.json       — Railway deploy config (backend)
└── netlify.toml       — Netlify deploy config (frontend)
```

---

## Tech Stack

| Layer | Technology |
|---|---|
| Payments | x402 protocol, Stellar SDK, USDC on testnet |
| AI | OpenRouter — Llama 3.3 70B (free tier) |
| Backend | Node.js, Express, WebSocket (ws) |
| Frontend | HTML, CSS, Vanilla JS — no framework |
| Deploy | Railway (backend) + Netlify (frontend) |

---

## Quick Start

### Prerequisites
- Node.js 18+
- A free [OpenRouter](https://openrouter.ai) API key

### 1. Clone and install

```bash
git clone https://github.com/Glayzz/agentmarket-pro.git
cd agentmarket-pro
npm install
```

### 2. Set up environment

```bash
cp .env.example .env
```

Open `.env` and add your OpenRouter API key:

```env
OPENROUTER_API_KEY=sk-or-v1-your-key-here
```

### 3. Generate and fund Stellar wallets

This creates 5 Stellar keypairs (one per agent) and funds them with testnet USDC automatically:

```bash
node setup-stellar.js
```

This writes all wallet keys into your `.env` file. The wallets are funded from Stellar's public testnet faucet — no real money needed.

### 4. Run the server

```bash
node server.js
```

### 5. Open the dashboard

Open `dashboard.html` directly in your browser, or serve it locally:

```bash
npx serve . -p 3000
# then open http://localhost:3000/dashboard.html
```

### 6. Check wallet balances

```bash
node check-balances.js
```

---

## Environment Variables

| Variable | Description |
|---|---|
| `OPENROUTER_API_KEY` | Your OpenRouter API key (free at openrouter.ai) |
| `OPENROUTER_MODEL` | Model to use (default: `meta-llama/llama-3.3-70b-instruct:free`) |
| `SERVER_SECRET` | Stellar secret key for the data server wallet |
| `SERVER_PUBLIC` | Stellar public key for the data server wallet |
| `ORCHESTRATOR_SECRET` | Stellar secret key for the orchestrator wallet |
| `ORCHESTRATOR_PUBLIC` | Stellar public key for the orchestrator wallet |
| `RESEARCH_SECRET` | Stellar secret key for the research agent wallet |
| `RESEARCH_PUBLIC` | Stellar public key for the research agent wallet |
| `WRITING_SECRET` | Stellar secret key for the writing agent wallet |
| `WRITING_PUBLIC` | Stellar public key for the writing agent wallet |
| `CODE_SECRET` | Stellar secret key for the code agent wallet |
| `CODE_PUBLIC` | Stellar public key for the code agent wallet |
| `USDC_ISSUER` | USDC issuer on testnet: `GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5` |
| `STELLAR_NETWORK` | `testnet` (default) or `mainnet` |
| `PORT` | Server port (Railway sets this automatically) |

---

## Deployment

### Backend — Railway

1. Go to [railway.app](https://railway.app) and create a new project from GitHub
2. Select the `agentmarket-pro` repo
3. Add all environment variables from your `.env` to Railway's Variables tab
4. Railway auto-deploys using `railway.json` — runs `node server.js`
5. Copy your Railway URL (e.g. `agentmarket-pro-production.up.railway.app`)

### Frontend — Netlify

1. Go to [netlify.com](https://netlify.com) and import from GitHub
2. Select `agentmarket-pro` — Netlify uses `netlify.toml` automatically
3. Before deploying, update the WebSocket URL in `dashboard.html`:

```js
// Line at top of the <script> tag:
const WS  = 'wss://your-railway-url.up.railway.app';
const API = 'https://your-railway-url.up.railway.app';
```

4. Push and Netlify deploys automatically

---

## API Reference

### Data APIs (paid endpoints — agents pay USDC to access)

| Endpoint | Price | Description |
|---|---|---|
| `GET /data/stock/:ticker` | 0.001 USDC | Stock price, volume, P/E, 52-week range |
| `GET /data/news?q=query` | 0.001 USDC | News articles with sentiment scores |
| `GET /data/macro` | 0.002 USDC | Fed rate, CPI, GDP, VIX, DXY, 10Y treasury |

### Agent Service APIs (agent-to-agent payments)

| Endpoint | Price | Description |
|---|---|---|
| `POST /agent/research` | 0.005 USDC | Full data gathering: stocks + news + macro |
| `POST /agent/writing` | 0.003 USDC | Polish raw data into a structured report |
| `POST /agent/code` | 0.004 USDC | Generate analysis scripts |

### Economy & Dashboard

| Endpoint | Description |
|---|---|
| `GET /economy` | Current balances, agent list, last 50 transactions |
| `POST /run` | Submit a query — triggers the full orchestrator chain |
| `GET /health` | Health check |
| `WS /` | WebSocket — real-time event stream for the dashboard |

---

## How the Orchestrator Works

The orchestrator is an LLM-powered agent (Llama 3.3 70B via OpenRouter) with a set of tools it can call. Each tool call triggers a real USDC payment on Stellar.

When a user submits a query:

1. The orchestrator receives the query and reasons about which agents/data to hire
2. It calls `hire_research_agent` → pays 0.005 USDC → gets stock, news, macro data
3. It calls `hire_writing_agent` → pays 0.003 USDC → gets a polished report
4. The final report is broadcast over WebSocket to the dashboard
5. A `report_ready` event fires and the report modal opens automatically

The entire flow — from query to report — happens without any human interaction beyond typing the initial query.

---

## Hackathon Tracks

| Track | How AgentMarket Pro qualifies |
|---|---|
| x402 on Stellar | Full x402 flow: 402 response → pay on Stellar → verify on-chain → serve |
| Autonomous agent payments | Agents initiate and settle payments with zero human involvement |
| Agent-to-agent commerce | Orchestrator → Research → Writing: a real multi-hop payment chain |

---

## Built by Glayzz

Solo project built for [Stellar Hacks: Agents](https://dorahacks.io/hackathon/stellar-agents-x402-stripe-mpp).

If you have questions or want to connect:
- GitHub: [@Glayzz](https://github.com/Glayzz)
- Telegram @Glayzz_4T9ne_BK or @Glayzz_4T9ne_XD
- X https://x.com/Glayzz_4T9ne_BK
- Hackathon: [DoraHacks submission](https://dorahacks.io/hackathon/stellar-agents-x402-stripe-mpp)
