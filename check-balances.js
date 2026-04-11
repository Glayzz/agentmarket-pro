import 'dotenv/config';
import * as StellarSdk from '@stellar/stellar-sdk';

const server = new StellarSdk.Horizon.Server('https://horizon-testnet.stellar.org');

const wallets = {
  orchestrator: process.env.ORCHESTRATOR_PUBLIC,
  research:     process.env.RESEARCH_PUBLIC,
  writing:      process.env.WRITING_PUBLIC,
  code:         process.env.CODE_PUBLIC,
  server:       process.env.SERVER_PUBLIC,
};

console.log('\n💰 AgentMarket Wallet Balances\n' + '─'.repeat(40));

for (const [name, pub] of Object.entries(wallets)) {
  if (!pub) { console.log(`${name}: ❌ PUBLIC KEY MISSING IN .env`); continue; }
  try {
    const account = await server.loadAccount(pub);
    const xlm  = account.balances.find(b => b.asset_type === 'native');
    const usdc = account.balances.find(b => b.asset_code === 'USDC');
    console.log(`${name.padEnd(14)} XLM: ${(xlm?.balance||'0').padEnd(12)}  USDC: ${usdc?.balance||'0'}`);
  } catch (e) {
    console.log(`${name.padEnd(14)} ❌ Account not found or not funded`);
  }
}
console.log('─'.repeat(40) + '\n');
