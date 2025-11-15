/**
 * Script to get wallet address for a phone number
 * 
 * Usage: npm run get-wallet <phone-number>
 * Example: npm run get-wallet +15551234567
 */

import dotenv from 'dotenv';
import { walletManager } from '../wallet/walletManager';

dotenv.config();

const phoneNumber = process.argv[2];

if (!phoneNumber) {
  console.error('❌ Please provide a phone number');
  console.log('Usage: npm run get-wallet <phone-number>');
  console.log('Example: npm run get-wallet +15551234567');
  process.exit(1);
}

async function main() {
  try {
    const wallet = await walletManager.getOrCreateWallet(phoneNumber);
    console.log('\n📱 Wallet Information:');
    console.log(`   Phone Number: ${phoneNumber}`);
    console.log(`   Wallet Address: ${wallet.address}`);
    console.log('\n💰 Fund this wallet at:');
    console.log(`   https://bank.testnet.algorand.network/`);
    console.log(`\n📋 Copy this address: ${wallet.address}\n`);
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

main();

