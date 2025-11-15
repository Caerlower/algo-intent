/**
 * Hashi API Client
 * 
 * Client for communicating with Hashi backend API
 * Handles wallet creation, signing, and transaction submission
 */

import dotenv from 'dotenv';
import algosdk from 'algosdk';

dotenv.config();

export interface WalletInfo {
  address: string;
  vaultKeyName: string;
  publicKey: string;
  phoneNumber: string;
}

export interface SignTransactionResponse {
  success: boolean;
  signature: string;
  message?: string;
}

export interface SubmitTransactionResponse {
  success: boolean;
  txId: string;
  message?: string;
}

export interface CreateWalletResponse {
  success: boolean;
  wallet: WalletInfo;
  message?: string;
}

export interface GetAddressResponse {
  success: boolean;
  address: string;
  phoneNumber: string;
  vaultKeyName: string;
}

/**
 * Hashi API Client Class
 */
export class HashiClient {
  private apiUrl: string;
  private apiToken: string | null;

  constructor() {
    this.apiUrl = process.env.HASHI_API_URL || 'http://localhost:8081';
    this.apiToken = process.env.HASHI_API_TOKEN || null;
    
    console.log(`🔗 Hashi client initialized: ${this.apiUrl}`);
    
    if (!this.apiToken) {
      console.warn('⚠️ HASHI_API_TOKEN not set - some operations may fail');
    }
  }

  /**
   * Get request headers
   */
  private getHeaders(): Record<string, string> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    
    if (this.apiToken) {
      headers['Authorization'] = `Bearer ${this.apiToken}`;
      // Also support Vault token header if needed
      headers['X-Vault-Token'] = this.apiToken;
    }
    
    return headers;
  }

  /**
   * Create or get wallet for phone number
   * 
   * @param phoneNumber - Phone number in E.164 format (e.g., +1234567890)
   * @returns Wallet information
   */
  async createWallet(phoneNumber: string): Promise<WalletInfo> {
    try {
      const response = await fetch(`${this.apiUrl}/v1/phone-wallet/create`, {
        method: 'POST',
        headers: this.getHeaders(),
        body: JSON.stringify({ phoneNumber }),
      });

      if (!response.ok) {
        const errorData = (await response.json().catch(() => ({ error: 'Unknown error' }))) as { error?: string };
        throw new Error(errorData.error || `HTTP error! status: ${response.status}`);
      }

      const result = (await response.json()) as CreateWalletResponse;
      
      if (!result.success || !result.wallet) {
        throw new Error(result.message || 'Failed to create wallet');
      }

      return result.wallet;
    } catch (error) {
      console.error('❌ Error creating wallet via Hashi:', error);
      throw new Error(`Failed to create wallet: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get wallet address for phone number (read-only, does not create)
   * 
   * @param phoneNumber - Phone number in E.164 format
   * @returns Wallet address
   * @throws Error if wallet does not exist (404)
   */
  async getAddress(phoneNumber: string): Promise<string> {
    try {
      const encodedPhone = encodeURIComponent(phoneNumber);
      const response = await fetch(`${this.apiUrl}/v1/phone-wallet/address?phoneNumber=${encodedPhone}`, {
        method: 'GET',
        headers: this.getHeaders(),
      });

      if (!response.ok) {
        const errorData = (await response.json().catch(() => ({ error: 'Unknown error' }))) as { error?: string };
        const errorMessage = errorData.error || `HTTP error! status: ${response.status}`;
        
        // 404 means wallet doesn't exist
        if (response.status === 404) {
          throw new Error(`Wallet not found: ${errorMessage}`);
        }
        
        throw new Error(errorMessage);
      }

      const result = (await response.json()) as GetAddressResponse;
      
      if (!result.success || !result.address) {
        throw new Error('Failed to get wallet address');
      }

      return result.address;
    } catch (error) {
      console.error('❌ Error getting address via Hashi:', error);
      throw error; // Re-throw to preserve error type
    }
  }

  /**
   * Get wallet information for phone number (read-only, does not create)
   * 
   * @param phoneNumber - Phone number in E.164 format
   * @returns Wallet information
   * @throws Error if wallet does not exist (404)
   */
  async getWallet(phoneNumber: string): Promise<WalletInfo> {
    try {
      const encodedPhone = encodeURIComponent(phoneNumber);
      const response = await fetch(`${this.apiUrl}/v1/phone-wallet/address?phoneNumber=${encodedPhone}`, {
        method: 'GET',
        headers: this.getHeaders(),
      });

      if (!response.ok) {
        const errorData = (await response.json().catch(() => ({ error: 'Unknown error' }))) as { error?: string };
        const errorMessage = errorData.error || `HTTP error! status: ${response.status}`;
        
        // 404 means wallet doesn't exist
        if (response.status === 404) {
          throw new Error(`Wallet not found: ${errorMessage}`);
        }
        
        throw new Error(errorMessage);
      }

      const result = (await response.json()) as GetAddressResponse;
      
      if (!result.success || !result.address) {
        throw new Error('Failed to get wallet');
      }

      return {
        address: result.address,
        phoneNumber: result.phoneNumber,
        vaultKeyName: result.vaultKeyName,
        publicKey: '', // Not returned by address endpoint, but that's okay
      };
    } catch (error) {
      console.error('❌ Error getting wallet via Hashi:', error);
      throw error; // Re-throw to preserve error type
    }
  }

  /**
   * Sign transaction using phone number's wallet
   * 
   * @param phoneNumber - Phone number
   * @param transaction - Unsigned transaction
   * @returns Signed transaction blob
   */
  async signTransaction(phoneNumber: string, transaction: algosdk.Transaction): Promise<Uint8Array> {
    try {
      // Get the bytes to sign (same as web app does)
      const messageToSign = transaction.bytesToSign();
      const transactionData = Buffer.from(messageToSign).toString('base64');

      const response = await fetch(`${this.apiUrl}/v1/phone-wallet/sign`, {
        method: 'POST',
        headers: this.getHeaders(),
        body: JSON.stringify({
          phoneNumber,
          transactionData,
        }),
      });

      if (!response.ok) {
        const errorData = (await response.json().catch(() => ({ error: 'Unknown error' }))) as { error?: string };
        throw new Error(errorData.error || `HTTP error! status: ${response.status}`);
      }

      const result = (await response.json()) as SignTransactionResponse;
      
      if (!result.success || !result.signature) {
        throw new Error(result.message || 'Failed to sign transaction');
      }

      // Parse signature from Vault format: vault:v1:signature_base64
      // Same extraction logic as web app's extractSignatureBytes
      let signatureBase64: string;
      
      if (result.signature.includes(':')) {
        const signatureParts = result.signature.split(':');
        if (signatureParts.length >= 3) {
          signatureBase64 = signatureParts[2];
        } else {
          console.warn(`⚠️ Unexpected signature format: ${result.signature}, using entire string as fallback`);
          signatureBase64 = result.signature;
        }
      } else {
        signatureBase64 = result.signature;
      }
      
      const signatureBytes = new Uint8Array(Buffer.from(signatureBase64, 'base64'));

      // Use attachSignature method (same as web app) - this properly formats the signed transaction
      const signerAddress = transaction.sender.toString();
      const signedTxn = transaction.attachSignature(signerAddress, signatureBytes);

      return new Uint8Array(signedTxn);
    } catch (error) {
      console.error('❌ Error signing transaction via Hashi:', error);
      throw new Error(`Transaction signing failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Submit signed transaction to Algorand network
   * 
   * @param signedTransaction - Signed transaction blob
   * @returns Transaction ID
   */
  async submitTransaction(signedTransaction: Uint8Array): Promise<string> {
    try {
      const signedTxnBase64 = Buffer.from(signedTransaction).toString('base64');

      const response = await fetch(`${this.apiUrl}/v1/phone-wallet/submit`, {
        method: 'POST',
        headers: this.getHeaders(),
        body: JSON.stringify({
          signedTransaction: signedTxnBase64,
        }),
      });

      if (!response.ok) {
        const errorData = (await response.json().catch(() => ({ error: 'Unknown error' }))) as { error?: string };
        throw new Error(errorData.error || `HTTP error! status: ${response.status}`);
      }

      const result = (await response.json()) as SubmitTransactionResponse;
      
      if (!result.success || !result.txId) {
        throw new Error(result.message || 'Failed to submit transaction');
      }

      return result.txId;
    } catch (error) {
      console.error('❌ Error submitting transaction via Hashi:', error);
      throw new Error(`Transaction submission failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
}

// Export singleton instance
export const hashiClient = new HashiClient();

