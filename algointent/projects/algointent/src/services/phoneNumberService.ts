/**
 * Phone Number Service
 * 
 * Resolves phone numbers to Algorand wallet addresses via Hashi API
 */

import { isValidPhoneNumberStrict, normalizePhoneNumber } from '../utils/phoneNumberUtils';

export interface PhoneWalletInfo {
  address: string;
  vaultKeyName: string;
  publicKey: string;
  phoneNumber: string;
}

export class PhoneNumberService {
  private hashiApiUrl: string;
  private hashiApiToken: string | null;

  constructor() {
    this.hashiApiUrl = import.meta.env.VITE_HASHI_API_URL || 'http://localhost:8081';
    this.hashiApiToken = import.meta.env.VITE_HASHI_API_TOKEN || null;
  }

  /**
   * Get request headers for Hashi API
   */
  private getHeaders(): Record<string, string> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    
    if (this.hashiApiToken) {
      headers['Authorization'] = `Bearer ${this.hashiApiToken}`;
      headers['X-Vault-Token'] = this.hashiApiToken;
    }
    
    return headers;
  }

  /**
   * Resolve phone number to wallet address
   * Creates wallet if it doesn't exist
   * 
   * @param phoneNumber - Phone number in E.164 format
   * @returns Wallet address
   */
  async resolvePhoneNumberToAddress(phoneNumber: string): Promise<string> {
    // Validate phone number format
    const normalized = normalizePhoneNumber(phoneNumber);
    if (!normalized) {
      throw new Error(`Invalid phone number format: ${phoneNumber}. Phone numbers must be in E.164 format (e.g., +1234567890)`);
    }

    // Strict validation - reject short numbers
    if (!isValidPhoneNumberStrict(normalized)) {
      throw new Error(`Invalid phone number: ${phoneNumber}. Phone number must be at least 9 digits (excluding country code).`);
    }

    try {
      // Create or get wallet for phone number
      const response = await fetch(`${this.hashiApiUrl}/v1/phone-wallet/create`, {
        method: 'POST',
        headers: this.getHeaders(),
        body: JSON.stringify({ phoneNumber: normalized }),
      });

      if (!response.ok) {
        const errorData = (await response.json().catch(() => ({ error: 'Unknown error' }))) as { error?: string };
        throw new Error(errorData.error || `Failed to resolve phone number: ${response.status}`);
      }

      const result = (await response.json()) as {
        success: boolean;
        wallet: PhoneWalletInfo;
        message?: string;
      };
      
      if (!result.success || !result.wallet || !result.wallet.address) {
        throw new Error(result.message || 'Failed to resolve phone number to address');
      }

      return result.wallet.address;
    } catch (error) {
      console.error('❌ Error resolving phone number:', error);
      throw error;
    }
  }

  /**
   * Get wallet address for phone number (read-only, does not create)
   * 
   * @param phoneNumber - Phone number in E.164 format
   * @returns Wallet address or null if wallet doesn't exist
   */
  async getAddressForPhoneNumber(phoneNumber: string): Promise<string | null> {
    const normalized = normalizePhoneNumber(phoneNumber);
    if (!normalized) {
      return null;
    }

    try {
      const encodedPhone = encodeURIComponent(normalized);
      const response = await fetch(`${this.hashiApiUrl}/v1/phone-wallet/address?phoneNumber=${encodedPhone}`, {
        method: 'GET',
        headers: this.getHeaders(),
      });

      if (!response.ok) {
        if (response.status === 404) {
          return null; // Wallet doesn't exist
        }
        const errorData = (await response.json().catch(() => ({ error: 'Unknown error' }))) as { error?: string };
        throw new Error(errorData.error || `Failed to get address: ${response.status}`);
      }

      const result = (await response.json()) as {
        success: boolean;
        address: string;
        phoneNumber: string;
        vaultKeyName: string;
      };
      
      if (!result.success || !result.address) {
        return null;
      }

      return result.address;
    } catch (error) {
      console.error('❌ Error getting address for phone number:', error);
      return null;
    }
  }
}

// Export singleton instance
export const phoneNumberService = new PhoneNumberService();

