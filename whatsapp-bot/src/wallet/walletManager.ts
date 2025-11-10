/**
 * Wallet Manager - Quick Demo Version
 * 
 * For quick demo: Creates wallets locally without Vault
 * TODO: Replace with Hashi + Vault integration later
 * 
 * Maps phone numbers to Algorand wallets
 */

import algosdk from 'algosdk';
import dotenv from 'dotenv';
import * as fs from 'fs';
import * as path from 'path';

dotenv.config();

/**
 * Wallet information structure
 */
export interface WalletInfo {
  address: string;
  phoneNumber: string;
  // For demo: store mnemonic in file (NOT secure for production!)
  // In production, this will be stored in Vault
  mnemonic?: string;
}

/**
 * Persistent wallet storage file path
 * Uses process.cwd() to get project root, works in both dev and production
 */
const WALLET_STORAGE_FILE = path.join(process.cwd(), 'data', 'wallets.json');

/**
 * Ensure data directory exists
 */
function ensureDataDirectory() {
  const dataDir = path.dirname(WALLET_STORAGE_FILE);
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }
}

/**
 * Load wallets from persistent storage
 */
function loadWallets(): Map<string, WalletInfo> {
  const walletStore = new Map<string, WalletInfo>();
  
  try {
    ensureDataDirectory();
    
    if (fs.existsSync(WALLET_STORAGE_FILE)) {
      const data = fs.readFileSync(WALLET_STORAGE_FILE, 'utf-8');
      const wallets = JSON.parse(data) as WalletInfo[];
      
      wallets.forEach(wallet => {
        walletStore.set(wallet.phoneNumber, wallet);
      });
      
      console.log(`📂 Loaded ${walletStore.size} wallet(s) from persistent storage`);
    } else {
      console.log('📂 No existing wallet storage found, starting fresh');
    }
  } catch (error) {
    console.error('❌ Error loading wallets:', error);
    console.log('⚠️ Starting with empty wallet store');
  }
  
  return walletStore;
}

/**
 * Save wallets to persistent storage
 */
function saveWallets(walletStore: Map<string, WalletInfo>) {
  try {
    ensureDataDirectory();
    
    const wallets = Array.from(walletStore.values());
    fs.writeFileSync(WALLET_STORAGE_FILE, JSON.stringify(wallets, null, 2), 'utf-8');
    console.log(`💾 Saved ${wallets.length} wallet(s) to persistent storage`);
  } catch (error) {
    console.error('❌ Error saving wallets:', error);
  }
}

/**
 * In-memory wallet storage (loaded from persistent storage on startup)
 */
const walletStore: Map<string, WalletInfo> = loadWallets();

/**
 * Wallet Manager Class
 * 
 * For quick demo: Generates wallets locally
 * TODO: Replace with Vault integration
 */
export class WalletManager {
  /**
   * Get or create wallet for a phone number
   * 
   * @param phoneNumber - User's phone number (e.g., +919350105090)
   * @returns Wallet information
   */
  async getOrCreateWallet(phoneNumber: string): Promise<WalletInfo> {
    try {
      // Check if wallet already exists
      const existing = walletStore.get(phoneNumber);
      if (existing) {
        const phoneDisplay = phoneNumber.length > 4 
          ? `${phoneNumber.slice(0, -4)}${'*'.repeat(4)}` 
          : phoneNumber;
        console.log(`📱 Wallet found for ${phoneDisplay}`);
        return existing;
      }

      // Create new wallet
      const phoneDisplay = phoneNumber.length > 4 
        ? `${phoneNumber.slice(0, -4)}${'*'.repeat(4)}` 
        : phoneNumber;
      console.log(`🔑 Creating new wallet for ${phoneDisplay}`);
      const account = algosdk.generateAccount();
      const mnemonic = algosdk.secretKeyToMnemonic(account.sk);
      
      // Convert Address type to string explicitly
      // account.addr is of type Address (branded string), but we need plain string
      const addressString = String(account.addr);

      const wallet: WalletInfo = {
        address: addressString,
        phoneNumber,
        mnemonic, // In production, this will be stored in Vault
      };

      walletStore.set(phoneNumber, wallet);
      console.log(`✅ Wallet created: ${addressString}`);
      
      // Save to persistent storage
      saveWallets(walletStore);

      return wallet;
    } catch (error) {
      console.error('❌ Error getting/creating wallet:', error);
      throw error;
    }
  }

  /**
   * Get wallet by phone number
   * 
   * @param phoneNumber - User's phone number
   * @returns Wallet information or null if not found
   */
  async getWallet(phoneNumber: string): Promise<WalletInfo | null> {
    return walletStore.get(phoneNumber) || null;
  }

  /**
   * Get account secret key for signing (for demo only!)
   * In production, signing will be done via Vault
   * 
   * @param phoneNumber - User's phone number
   * @returns Secret key
   */
  async getSecretKey(phoneNumber: string): Promise<Uint8Array> {
    const wallet = walletStore.get(phoneNumber);
    if (!wallet || !wallet.mnemonic) {
      throw new Error(`Wallet not found for ${phoneNumber}`);
    }

    return algosdk.mnemonicToSecretKey(wallet.mnemonic).sk;
  }

  /**
   * Sign transaction with wallet
   * 
   * @param txn - Transaction to sign
   * @param phoneNumber - User's phone number
   * @returns Signed transaction blob
   */
  async signTransaction(txn: algosdk.Transaction, phoneNumber: string): Promise<Uint8Array> {
    try {
      const secretKey = await this.getSecretKey(phoneNumber);
      const signedTxn = algosdk.signTransaction(txn, secretKey);
      return signedTxn.blob;
    } catch (error) {
      console.error('❌ Error signing transaction:', error);
      throw error;
    }
  }
}

// Export singleton instance
export const walletManager = new WalletManager();

