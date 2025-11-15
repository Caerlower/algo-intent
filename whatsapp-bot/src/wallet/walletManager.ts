/**
 * Wallet Manager - Hashi Integration
 * 
 * Manages Algorand wallets for phone numbers using Hashi + Vault
 * Replaces local file storage with secure Vault-based key management
 */

import algosdk from 'algosdk';
import { hashiClient, WalletInfo } from '../hashi/hashiClient';

/**
 * Wallet information structure
 */
export interface WalletInfoLocal {
  address: string;
  phoneNumber: string;
  vaultKeyName?: string;
}

/**
 * Wallet Manager Class
 * 
 * Uses Hashi API to create and manage wallets in Vault
 * All private keys are stored securely in Hashicorp Vault
 */
export class WalletManager {
  /**
   * Get or create wallet for a phone number
   * 
   * @param phoneNumber - User's phone number (e.g., +15551234567)
   * @returns Wallet information
   */
  async getOrCreateWallet(phoneNumber: string): Promise<WalletInfoLocal> {
    try {
      const phoneDisplay = phoneNumber.length > 4 
        ? `${phoneNumber.slice(0, -4)}${'*'.repeat(4)}` 
        : phoneNumber;
      
      console.log(`🔑 Getting/creating wallet for ${phoneDisplay} via Hashi...`);
      
      // Use Hashi API to create/get wallet
      const wallet = await hashiClient.createWallet(phoneNumber);
      
      console.log(`✅ Wallet ready: ${wallet.address}`);
      
      return {
        address: wallet.address,
        phoneNumber: wallet.phoneNumber,
        vaultKeyName: wallet.vaultKeyName,
      };
    } catch (error) {
      console.error('❌ Error getting/creating wallet:', error);
      throw error;
    }
  }

  /**
   * Get wallet by phone number (read-only, does not create)
   * 
   * @param phoneNumber - User's phone number
   * @returns Wallet information or null if not found
   */
  async getWallet(phoneNumber: string): Promise<WalletInfoLocal | null> {
    try {
      // Use getWallet which only retrieves, doesn't create
      const wallet = await hashiClient.getWallet(phoneNumber);
      return {
        address: wallet.address,
        phoneNumber: wallet.phoneNumber,
        vaultKeyName: wallet.vaultKeyName,
      };
    } catch (error) {
      // If wallet not found, return null as documented
      if (error instanceof Error && error.message.includes('not found')) {
        console.log(`📱 Wallet not found for ${phoneNumber.substring(0, 4)}****`);
        return null;
      }
      console.error('❌ Error getting wallet:', error);
      return null;
    }
  }

  /**
   * Get wallet address for phone number
   * 
   * @param phoneNumber - User's phone number
   * @returns Wallet address
   */
  async getWalletAddress(phoneNumber: string): Promise<string> {
    try {
      return await hashiClient.getAddress(phoneNumber);
    } catch (error) {
      console.error('❌ Error getting wallet address:', error);
      throw error;
    }
  }

  /**
   * Sign transaction with wallet using Hashi
   * 
   * @param txn - Transaction to sign
   * @param phoneNumber - User's phone number
   * @returns Signed transaction blob
   */
  async signTransaction(txn: algosdk.Transaction, phoneNumber: string): Promise<Uint8Array> {
    try {
      // Use Hashi API to sign transaction
      return await hashiClient.signTransaction(phoneNumber, txn);
    } catch (error) {
      console.error('❌ Error signing transaction:', error);
      throw error;
    }
  }

  /**
   * Submit signed transaction to Algorand network via Hashi
   * 
   * @param signedTxn - Signed transaction blob
   * @returns Transaction ID
   */
  async submitTransaction(signedTxn: Uint8Array): Promise<string> {
    try {
      // Use Hashi API to submit transaction
      return await hashiClient.submitTransaction(signedTxn);
    } catch (error) {
      console.error('❌ Error submitting transaction:', error);
      throw error;
    }
  }
}

// Export singleton instance
export const walletManager = new WalletManager();
