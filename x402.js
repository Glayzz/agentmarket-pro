/**
 * x402.js — Shared payment utilities
 * Handles the full x402 flow: 402 → pay on Stellar → retry with proof
 * Used by all agents in the economy.
 */

import * as StellarSdk from '@stellar/stellar-sdk';

const HORIZON_URL = process.env.STELLAR_HORIZON_URL || 'https://horizon-testnet.stellar.org';
const NETWORK_PASSPHRASE = process.env.STELLAR_NETWORK === 'mainnet'
  ? StellarSdk.Networks.PUBLIC
  : StellarSdk.Networks.TESTNET;

const USDC_ISSUER = process.env.USDC_ISSUER || 'GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5';
const USDC = new StellarSdk.Asset('USDC', USDC_ISSUER);
const horizon = new StellarSdk.Horizon.Server(HORIZON_URL);

/**
 * Pay USDC on Stellar and return base64 proof for x402 header
 */
export async function stellarPay(keypair, destination, amount, memo = 'x402') {
  const account = await horizon.loadAccount(keypair.publicKey());

  const tx = new StellarSdk.TransactionBuilder(account, {
    fee: StellarSdk.BASE_FEE,
    networkPassphrase: NETWORK_PASSPHRASE,
  })
    .addOperation(StellarSdk.Operation.payment({
      destination,
      asset: USDC,
      amount: amount.toString(),
    }))
    .addMemo(StellarSdk.Memo.text(memo.slice(0, 28)))
    .setTimeout(30)
    .build();

  tx.sign(keypair);
  const result = await horizon.submitTransaction(tx);

  return {
    txHash: result.hash,
    proof: Buffer.from(JSON.stringify({
      txHash: result.hash,
      amount,
      sender: keypair.publicKey(),
    })).toString('base64'),
  };
}

/**
 * Make an x402-aware fetch — handles 402 → pay → retry automatically
 */
export async function x402Fetch(url, keypair, agentName = 'agent') {
  const headers = {
    'Content-Type': 'application/json',
    'x-agent-id': agentName,
  };

  // First attempt
  let res = await fetch(url, { headers });

  if (res.status !== 402) {
    if (!res.ok) throw new Error(`HTTP ${res.status} from ${url}`);
    return res.json();
  }

  // Got 402 — parse payment instructions
  const { payment } = await res.json();
  console.log(`    💳 [${agentName}] 402 on ${new URL(url).pathname} → paying ${payment.price} USDC`);

  // Pay
  const { proof } = await stellarPay(
    keypair,
    payment.destination,
    parseFloat(payment.price),
    payment.memo || 'x402'
  );

  // Retry with proof
  res = await fetch(url, { headers: { ...headers, 'x-payment': proof } });
  if (!res.ok) throw new Error(`Payment rejected: ${await res.text()}`);
  return res.json();
}

/**
 * Verify incoming x402 payment (used by server-side middleware)
 */
export async function verifyPayment(txHash, expectedAmount, expectedDestination) {
  try {
    const tx = await horizon.transactions().transaction(txHash).call();

    // Must be recent (5 min)
    if (Date.now() - new Date(tx.created_at).getTime() > 5 * 60 * 1000) {
      return { ok: false, reason: 'Transaction too old' };
    }

    const ops = await tx.operations();
    const op = ops.records.find(o =>
      o.type === 'payment' &&
      o.to === expectedDestination &&
      o.asset_code === 'USDC' &&
      parseFloat(o.amount) >= expectedAmount
    );

    if (!op) return { ok: false, reason: 'No matching payment found' };
    return { ok: true, sender: op.from, amount: parseFloat(op.amount) };
  } catch (e) {
    return { ok: false, reason: e.message };
  }
}

/**
 * x402 Express middleware factory
 */
export function x402Middleware(priceUsdc, serviceName, serverPublic, broadcast) {
  return async (req, res, next) => {
    const paymentHeader = req.headers['x-payment'];

    if (!paymentHeader) {
      if (broadcast) broadcast({ type: 'payment_required', service: serviceName, price: priceUsdc, agent: req.headers['x-agent-id'] || '?' });
      return res.status(402).json({
        error: 'Payment Required',
        payment: {
          version: 'x402/1.0',
          scheme: 'stellar',
          network: process.env.STELLAR_NETWORK || 'testnet',
          asset: 'USDC',
          price: priceUsdc.toString(),
          destination: serverPublic,
          memo: `agentmarket-${serviceName}`,
        },
      });
    }

    try {
      const proof = JSON.parse(Buffer.from(paymentHeader, 'base64').toString());
      const check = await verifyPayment(proof.txHash, priceUsdc, serverPublic);
      if (!check.ok) return res.status(402).json({ error: check.reason });

      req.payment = { ...proof, service: serviceName };
      if (broadcast) broadcast({ type: 'payment_verified', service: serviceName, price: priceUsdc, txHash: proof.txHash, sender: proof.sender, agent: req.headers['x-agent-id'] || '?' });
      next();
    } catch (e) {
      res.status(400).json({ error: 'Invalid payment header' });
    }
  };
}
