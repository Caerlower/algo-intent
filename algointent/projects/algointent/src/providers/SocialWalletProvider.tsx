import { GoogleAuthService } from '../services/googleAuthService';
import { Wallet, WalletId, WalletAccount, WalletMetadata } from '@txnlab/use-wallet-react';
import { Transaction } from 'algosdk';
import * as algosdk from 'algosdk';

export interface SocialWallet extends Wallet {
  id: WalletId;
  metadata: WalletMetadata;
  googleAuthService: GoogleAuthService;
}

export class SocialWalletProvider {
  private googleAuthService: GoogleAuthService;
  private isConnected: boolean = false;
  private address: string | null = null;

  constructor() {
    this.googleAuthService = new GoogleAuthService();
  }

  async connect(): Promise<void> {
    try {
      const result = await this.googleAuthService.signInWithGoogle();
      
      if (result.success && result.wallet) {
        this.address = result.wallet.address;
        this.isConnected = true;
      } else {
        throw new Error(result.error || 'Failed to connect with Google');
      }
    } catch (error) {
      throw new Error(`Google authentication failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async disconnect(): Promise<void> {
    try {
      await this.googleAuthService.signOut();
      this.address = null;
      this.isConnected = false;
    } catch (error) {
      console.error('Disconnect error:', error);
    }
  }

  async signTransaction(transaction: Transaction): Promise<Uint8Array> {
    if (!this.isConnected || !this.address) {
      throw new Error('Wallet not connected');
    }

    try {
      // Encode the transaction using algosdk
      const encodedTransaction = algosdk.encodeUnsignedTransaction(transaction);
      
      // Sign using Hashi backend
      const { signature } = await this.googleAuthService.signTransaction(encodedTransaction);
      
      // Parse the signature and attach it to the transaction
      const signatureBytes = new Uint8Array(Buffer.from(signature.split(':')[2], 'base64'));
      
      // Create signed transaction
      const signedTransaction = new Uint8Array(encodedTransaction.length + signatureBytes.length);
      signedTransaction.set(encodedTransaction);
      signedTransaction.set(signatureBytes, encodedTransaction.length);
      
      return signedTransaction;
    } catch (error) {
      throw new Error(`Transaction signing failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async signTransactions(transactions: Transaction[]): Promise<Uint8Array[]> {
    const signedTransactions: Uint8Array[] = [];
    
    for (const transaction of transactions) {
      const signedTransaction = await this.signTransaction(transaction);
      signedTransactions.push(signedTransaction);
    }
    
    return signedTransactions;
  }

  getAddress(): string | null {
    return this.address;
  }

  isActive(): boolean {
    return this.isConnected && this.address !== null;
  }

  getMetadata(): WalletMetadata {
    return {
      name: 'Google Social Wallet',
      icon: 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjQiIGhlaWdodD0iMjQiIHZpZXdCb3g9IjAgMCAyNCAyNCIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPHBhdGggZD0iTTIyLjU2IDEyLjI1QzIyLjU2IDExLjQ3IDIyLjQ5IDEwLjcyIDIyLjM2IDEwSDEyVjE0LjI2SDUuOTJDNS42NiAxNS42MyA0LjgyIDE2Ljc5IDMuNjUgMTcuNTdWNjAuMjRIMjIuNTZDMjIuNTYgNTcuOTggMjMuNzYgNTUuMTYgMjMuNzYgNTIuMDlDMjMuNzYgNDkuMDIgMjIuNTYgNDYuMiAyMi41NiA0My45M1YxMi4yNVoiIGZpbGw9IiM0Mjg1RjQiLz4KPHBhdGggZD0iTTEyIDIzQzE0Ljk3IDIzIDE3LjQ2IDIyLjAyIDE5LjI4IDIwLjM0TDE1LjcxIDE3LjU3QzE0LjczIDE4LjIzIDEzLjIzIDE4LjY2IDExLjcxIDE4LjY2QzguODUgMTguNjYgNi40MiAxNi43MyA1LjU1IDE0LjA5SDIuMThWMTYuOTNDMy45OSAyMC41MyA3LjcgMjMgMTIgMjNaIiBmaWxsPSIjMzRBODUzIi8+CjxwYXRoIGQ9Ik01Ljg0IDE0LjA5QzUuNjIgMTMuNDMgNS40OSAxMi43MyA1LjQ5IDEyQzUuNDkgMTEuMjcgNS42MiAxMC41NyA1Ljg0IDkuOTFWNy4wN0gyLjE4QzEuNDMgOC41NSAxIDEwLjIyIDEgMTJDMSAxMy43OCAxLjQzIDE1LjQ1IDIuMTggMTYuOTNMNS44NCAxNC4wOVoiIGZpbGw9IiNGQkJDMDQiLz4KPHBhdGggZD0iTTEyIDUuMzhDMTMuNjIgNS4zOCAxNS4wNiA1Ljk0IDE2LjIxIDcuMDJMMTkuMzYgMy44N0MxNy40NSAxLjk2IDE0Ljk3IDEgMTIgMUM3LjcgMSAzLjk5IDMuNDcgMi4xOCA3LjA3TDUuODQgOS45MUM2LjcxIDcuMzEgOS4xNCA1LjM4IDEyIDUuMzhaIiBmaWxsPSIjRUE0MzM1Ii8+Cjwvc3ZnPgo=',
    };
  }
}

// Create the social wallet instance
export const socialWallet: SocialWallet = {
  id: WalletId.DEFLY, // Using DEFLY as a placeholder since we can't extend WalletId enum
  metadata: {
    name: 'Google Social Wallet',
    icon: 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjQiIGhlaWdodD0iMjQiIHZpZXdCb3g9IjAgMCAyNCAyNCIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPHBhdGggZD0iTTIyLjU2IDEyLjI1QzIyLjU2IDExLjQ3IDIyLjQ5IDEwLjcyIDIyLjM2IDEwSDEyVjE0LjI2SDUuOTJDNS42NiAxNS42MyA0LjgyIDE2Ljc5IDMuNjUgMTcuNTdWNjAuMjRIMjIuNTZDMjIuNTYgNTcuOTggMjMuNzYgNTUuMTYgMjMuNzYgNTIuMDlDMjMuNzYgNDkuMDIgMjIuNTYgNDYuMiAyMi41NiA0My45M1YxMi4yNVoiIGZpbGw9IiM0Mjg1RjQiLz4KPHBhdGggZD0iTTEyIDIzQzE0Ljk3IDIzIDE3LjQ2IDIyLjAyIDE5LjI4IDIwLjM0TDE1LjcxIDE3LjU3QzE0LjczIDE4LjIzIDEzLjIzIDE4LjY2IDExLjcxIDE4LjY2QzguODUgMTguNjYgNi40MiAxNi43MyA1LjU1IDE0LjA5SDIuMThWMTYuOTNDMy45OSAyMC41MyA3LjcgMjMgMTIgMjNaIiBmaWxsPSIjMzRBODUzIi8+CjxwYXRoIGQ9Ik01Ljg0IDE0LjA5QzUuNjIgMTMuNDMgNS40OSAxMi43MyA1LjQ5IDEyQzUuNDkgMTEuMjcgNS42MiAxMC41NyA1Ljg0IDkuOTFWNy4wN0gyLjE4QzEuNDMgOC41NSAxIDEwLjIyIDEgMTJDMSAxMy43OCAxLjQzIDE1LjQ1IDIuMTggMTYuOTNMNS44NCAxNC4wOVoiIGZpbGw9IiNGQkJDMDQiLz4KPHBhdGggZD0iTTEyIDUuMzhDMTMuNjIgNS4zOCAxNS4wNiA1Ljk0IDE2LjIxIDcuMDJMMTkuMzYgMy44N0MxNy40NSAxLjk2IDE0Ljk3IDEgMTIgMUM3LjcgMSAzLjk5IDMuNDcgMi4xOCA3LjA3TDUuODQgOS45MUM2LjcxIDcuMzEgOS4xNCA1LjM4IDEyIDUuMzhaIiBmaWxsPSIjRUE0MzM1Ii8+Cjwvc3ZnPgo=',
  },
  accounts: [],
  activeAccount: null,
  isConnected: false,
  isActive: false,
  canSignData: true,
  googleAuthService: new GoogleAuthService(),
  connect: async function(args?: Record<string, any>): Promise<WalletAccount[]> {
    const result = await this.googleAuthService.signInWithGoogle();
    if (!result.success) {
      throw new Error(result.error || 'Failed to connect');
    }
    
    if (result.wallet) {
      const account: WalletAccount = {
        address: result.wallet.address,
        name: result.user?.name || 'Google Wallet',
      };
      
      this.accounts = [account];
      this.activeAccount = account;
      this.isConnected = true;
      this.isActive = true;
      
      return [account];
    }
    
    return [];
  },
  disconnect: async function(): Promise<void> {
    await this.googleAuthService.signOut();
    this.accounts = [];
    this.activeAccount = null;
    this.isConnected = false;
    this.isActive = false;
  },
  setActive: function(): void {
    this.isActive = true;
  },
  setActiveAccount: function(address: string): void {
    const account = this.accounts.find(acc => acc.address === address);
    if (account) {
      this.activeAccount = account;
    }
  },
};
