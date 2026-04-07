# AgentMarket Pro ⚡

> A live AI agent economy where autonomous agents hire each other and pay in real USDC via x402 on Stellar.

**Built for Stellar Hacks: Agents — x402 + Stripe MPP Track**

---

## The Problem

AI agents can reason, plan, and act — but they hit a wall the moment they need to pay for something. Every existing solution requires a human to set up billing, manage API keys, or approve transactions. That's not autonomous. That's a human with extra steps.

## What We Built

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

Every arrow is a real USDC transaction on Stellar testnet, settled in under 5 seconds.

---

## How x402 Works

1. Agent requests a service endpoint
2. Server responds with **HTTP 402 Payment Required** + Stellar payment instructions
3. Agent automatically pays USDC on Stellar — no human approval
4. Agent retries with cryptographic payment proof in the `X-Payment` header
5. Server verifies on-chain and serves the response

```
Agent                    Server                   Stellar
  │                        │                         │
  │── GET /data/stock ─────►│                         │
  │◄── 402 + instructions ──│                         │
  │    price: 0.001 USDC   │                         │
  │                        │                         │
  │────── pay USDC ─────────────────────────────────►│
  │◄───── txHash ───────────────────────────────────-│
  │                        │                         │
  │── GET /data/stock ─────►│                         │
  │   X-Payment: <proof>   │── verify on Stellar ───►│
  │◄── 200 + data ──────────│◄── confirmed ───────────│
```

---

## Why Stellar

| Requirement | Stellar |
|-------------|---------|
| Settlement speed | Under 5 seconds — x402 is synchronous HTTP |
| Transaction fee | ~$0.00001 — micropayments are economically viable |
| Stablecoin | Native USDC — no bridging, no wrapping |
| Finality | Deterministic — no reorgs |

---

## Features

- **Agent-to-agent payments** — Orchestrator hires Research Agent, Research Agent hires Writing Agent. A full payment chain, zero human involvement
- **x402 on Stellar** — every API call is a real USDC micropayment verified on-chain
- **Live economy dashboard** — animated payment flow, per-agent balance tracking, real-time transaction log
- **5 autonomous wallets** — each agent has its own Stellar keypair and earns/spends independently
- **Free AI** — powered by OpenRouter (Llama 3.3 70B), no paid API key required

---

## Hackathon Tracks

| Track | How we qualify |
|-------|---------------|
| x402 on Stellar | Full x402 flow — 402 response → pay → verify → serve |
| Autonomous agent payments | Agents initiate and settle payments with no human in the loop |
| Agent-to-agent commerce | Orchestrator → Research → Writing — a real payment chain |

---

## Quick Start

```bash
# Install dependencies
npm install

# Generate and fund all 5 Stellar wallets automatically
node setup-stellar.js

# Add your free OpenRouter key to .env
# Get it at openrouter.ai — no credit card needed

# Run the server (Terminal 1)
node server.js

# Run the orchestrator agent (Terminal 2)
node orchestrator.js

# Open dashboard.html in your browser
```

---

## Project Structure

```
agentmarket/
├── server.js          — x402 API server + agent service registry + WebSocket
├── orchestrator.js    — Master agent, hires and pays specialist agents
├── x402.js            — Shared payment utilities (pay, verify, middleware)
├── setup-stellar.js   — One-command wallet generation and funding
├── dashboard.html     — Live economy dashboard
├── .env.example       — Environment config template
├── railway.json       — Railway deploy config (backend)
└── netlify.toml       — Netlify deploy config (dashboard)
```

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Payments | x402 protocol, Stellar SDK, USDC testnet |
| AI | OpenRouter — Llama 3.3 70B (free tier) |
| Backend | Node.js, Express, WebSocket |
| Frontend | HTML, CSS, JavaScript |
| Deploy | Railway (server) + Netlify (dashboard) |

---

*Built for Stellar Hacks: Agents by Glayzz*
# AgentMarket Pro ⚡

> A live AI agent economy where autonomous agents hire each other and pay in real USDC via x402 on Stellar.

**Built for Stellar Hacks: Agents — x402 + Stripe MPP Track**

---

## The Problem

AI agents can reason, plan, and act — but they hit a wall the moment they need to pay for something. Every existing solution requires a human to set up billing, manage API keys, or approve transactions. That's not autonomous. That's a human with extra steps.

## What We Built

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

Every arrow is a real USDC transaction on Stellar testnet, settled in under 5 seconds.

---

## How x402 Works

1. Agent requests a service endpoint
2. Server responds with **HTTP 402 Payment Required** + Stellar payment instructions
3. Agent automatically pays USDC on Stellar — no human approval
4. Agent retries with cryptographic payment proof in the `X-Payment` header
5. Server verifies on-chain and serves the response

```
Agent                    Server                   Stellar
  │                        │                         │
  │── GET /data/stock ─────►│                         │
  │◄── 402 + instructions ──│                         │
  │    price: 0.001 USDC   │                         │
  │                        │                         │
  │────── pay USDC ─────────────────────────────────►│
  │◄───── txHash ───────────────────────────────────-│
  │                        │                         │
  │── GET /data/stock ─────►│                         │
  │   X-Payment: <proof>   │── verify on Stellar ───►│
  │◄── 200 + data ──────────│◄── confirmed ───────────│
```

---

## Why Stellar

| Requirement | Stellar |
|-------------|---------|
| Settlement speed | Under 5 seconds — x402 is synchronous HTTP |
| Transaction fee | ~$0.00001 — micropayments are economically viable |
| Stablecoin | Native USDC — no bridging, no wrapping |
| Finality | Deterministic — no reorgs |

---

## Features

- **Agent-to-agent payments** — Orchestrator hires Research Agent, Research Agent hires Writing Agent. A full payment chain, zero human involvement
- **x402 on Stellar** — every API call is a real USDC micropayment verified on-chain
- **Live economy dashboard** — animated payment flow, per-agent balance tracking, real-time transaction log
- **5 autonomous wallets** — each agent has its own Stellar keypair and earns/spends independently
- **Free AI** — powered by OpenRouter (Llama 3.3 70B), no paid API key required

---

## Hackathon Tracks

| Track | How we qualify |
|-------|---------------|
| x402 on Stellar | Full x402 flow — 402 response → pay → verify → serve |
| Autonomous agent payments | Agents initiate and settle payments with no human in the loop |
| Agent-to-agent commerce | Orchestrator → Research → Writing — a real payment chain |

---

## Quick Start

```bash
# Install dependencies
npm install

# Generate and fund all 5 Stellar wallets automatically
node setup-stellar.js

# Add your free OpenRouter key to .env
# Get it at openrouter.ai — no credit card needed

# Run the server (Terminal 1)
node server.js

# Run the orchestrator agent (Terminal 2)
node orchestrator.js

# Open dashboard.html in your browser
```

---

## Project Structure

```
agentmarket/
├── server.js          — x402 API server + agent service registry + WebSocket
├── orchestrator.js    — Master agent, hires and pays specialist agents
├── x402.js            — Shared payment utilities (pay, verify, middleware)
├── setup-stellar.js   — One-command wallet generation and funding
├── dashboard.html     — Live economy dashboard
├── .env.example       — Environment config template
├── railway.json       — Railway deploy config (backend)
└── netlify.toml       — Netlify deploy config (dashboard)
```

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Payments | x402 protocol, Stellar SDK, USDC testnet |
| AI | OpenRouter — Llama 3.3 70B (free tier) |
| Backend | Node.js, Express, WebSocket |
| Frontend | HTML, CSS, JavaScript |
| Deploy | Railway (server) + Netlify (dashboard) |

---

*Built for Stellar Hacks: Agents by Glayzz*
