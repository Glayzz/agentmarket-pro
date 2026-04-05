/**
 * setup-stellar.js
 * Generates and funds all 5 agent wallets on Stellar testnet.
 * Adds USDC trustlines and writes keys to .env automatically.
 * Run once: node setup-stellar.js
 */

import * as StellarSdk from '@stellar/stellar-sdk';
import fs from 'fs';
import path from 'path';

const HORIZON = 'https://horizon-testnet.stellar.org';
const NETWORK = StellarSdk.Networks.TESTNET;
const USDC_ISSUER = 'GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5';
const USDC = new StellarSdk.Asset('USDC', USDC_ISSUER);

const server = new StellarSdk.Horizon.Server(HORIZON);

const WALLETS = ['SERVER', 'ORCHESTRATOR', 'RESEARCH', 'WRITING', 'CODE'];

async function friendbot(publicKey) {
  const res = await fetch(`https://friendbot.stellar.org?addr=${publicKey}`);
  if (!res.ok) throw new Error(`Friendbot failed for ${publicKey}`);
  await res.json();
}

async function addUsdcTrustline(keypair) {
  const account = await server.loadAccount(keypair.publicKey());
  const tx = new StellarSdk.TransactionBuilder(account, {
    fee: StellarSdk.BASE_FEE,
    networkPassphrase: NETWORK,
  })
    .addOperation(StellarSdk.Operation.changeTrust({ asset: USDC }))
    .setTimeout(30)
    .build();

  tx.sign(keypair);
  await server.submitTransaction(tx);
}

async function fundWithUsdc(destinationPublic, sourceKeypair, amount = '10') {
  const account = await server.loadAccount(sourceKeypair.publicKey());
  const tx = new StellarSdk.TransactionBuilder(account, {
    fee: StellarSdk.BASE_FEE,
    networkPassphrase: NETWORK,
  })
    .addOperation(
      StellarSdk.Operation.payment({
        destination: destinationPublic,
        asset: USDC,
        amount,
      })
    )
    .setTimeout(30)
    .build();

  tx.sign(sourceKeypair);
  await server.submitTransaction(tx);
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function main() {
  console.log('\n🚀 AgentMarket — Stellar Wallet Setup\n');

  const keypairs = {};

  // Step 1: Generate all keypairs
  console.log('📋 Generating keypairs...');
  for (const name of WALLETS) {
    keypairs[name] = StellarSdk.Keypair.random();
    console.log(`  ${name}: ${keypairs[name].publicKey()}`);
  }

  // Step 2: Fund with testnet XLM via Friendbot
  console.log('\n💧 Funding with testnet XLM (Friendbot)...');
  for (const name of WALLETS) {
    process.stdout.write(`  Funding ${name}... `);
    await friendbot(keypairs[name].publicKey());
    await sleep(1000);
    console.log('✅');
  }

  // Step 3: Add USDC trustlines
  console.log('\n🔗 Adding USDC trustlines...');
  for (const name of WALLETS) {
    process.stdout.write(`  Trustline for ${name}... `);
    await addUsdcTrustline(keypairs[name]);
    await sleep(500);
    console.log('✅');
  }

  // Step 4: Fund agent wallets with testnet USDC from a faucet account
  // We use the ORCHESTRATOR as the "loaded" wallet and distribute from there.
  // In testnet, we use the Stellar testnet USDC issuer directly if possible,
  // otherwise we note that the user needs to get USDC from the testnet faucet.
  console.log('\n💵 Note: Add testnet USDC to your ORCHESTRATOR wallet via:');
  console.log('   https://stellar.expert/explorer/testnet');
  console.log(`   Address: ${keypairs['ORCHESTRATOR'].publicKey()}\n`);

  // Step 5: Write to .env
  const envPath = path.resolve('.env');
  let envContent = fs.existsSync(envPath) ? fs.readFileSync(envPath, 'utf8') : fs.readFileSync('.env.example', 'utf8');

  for (const name of WALLETS) {
    const pub = keypairs[name].publicKey();
    const sec = keypairs[name].secret();
    envContent = envContent.replace(`${name}_PUBLIC=`, `${name}_PUBLIC=${pub}`);
    envContent = envContent.replace(`${name}_SECRET=`, `${name}_SECRET=${sec}`);
  }

  fs.writeFileSync(envPath, envContent);

  console.log('✅ Keys written to .env\n');
  console.log('═'.repeat(50));
  console.log('Next steps:');
  console.log('  1. Get testnet USDC from https://stellar.expert/explorer/testnet');
  console.log(`     Send to ORCHESTRATOR: ${keypairs['ORCHESTRATOR'].publicKey()}`);
  console.log('  2. node server.js');
  console.log('  3. node orchestrator.js');
  console.log('═'.repeat(50) + '\n');
}

main().catch(console.error);
