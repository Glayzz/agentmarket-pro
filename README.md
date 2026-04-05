# AgentMarket Pro 🤖

> A live AI agent economy where agents autonomously hire each other and pay via x402 on Stellar.

Built for **Stellar Hacks: Agents** (x402 + Stripe MPP track).

---

## The Big Idea

Most AI agent demos show one agent paying for one API. We built an **economy**:

```
User Query
    │
    ▼
Orchestrator (pays 0.005 USDC) ──► Research Agent
                                        │ pays 0.001 USDC × N ──► Data APIs (stock/news/macro)
                                        │ pays 0.003 USDC ──────► Writing Agent
                                    ▼
                              Polished Report
```

Every arrow is a real USDC payment on Stellar testnet. The dashboard shows it all live.

---

## Setup (< 10 minutes)

```bash
npm install
node setup-stellar.js      # generates + funds all 5 wallets automatically
cp .env.example .env       # fill in OPENROUTER_API_KEY (free at openrouter.ai)
```

## Run

```bash
# Terminal 1 — Economy server
node server.js

# Terminal 2 — Orchestrator agent
node orchestrator.js

# Browser — Live dashboard
open dashboard.html
```

## Deploy

**Backend → Railway (free)**
1. Push to GitHub
2. railway.app → New Project → Deploy from GitHub
3. Add your `.env` vars in Railway dashboard

**Frontend → Netlify (free)**
1. Update `YOUR-APP.railway.app` in `netlify.toml` with your Railway URL
2. netlify.com → New Site → Deploy from GitHub (or drag-drop the folder)

---

## Why it wins

| Criteria | What we built |
|----------|--------------|
| Agentic depth | 3 specialist agents with their own wallets, each earning + spending |
| x402 on Stellar | Every service call goes through real x402 payment flow |
| Commerce realism | Agent-to-agent hiring, real USDC transactions, live economy ledger |
| Polish | Hosted dashboard with live flow visualization |

---

## Stack

- **x402**: Custom middleware, Stellar SDK for USDC payments
- **AI**: OpenRouter (free Llama 3.3 70B) with tool calling
- **Infra**: Express + WebSocket + Stellar Testnet
- **Deploy**: Railway (server) + Netlify (dashboard)
