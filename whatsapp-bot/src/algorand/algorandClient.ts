/**
 * Algorand Client - Connection to Algorand Network
 * 
 * Handles connection to Algorand testnet/mainnet and provides
 * methods for checking balances, building transactions, etc.
 */

import algosdk from 'algosdk';
import dotenv from 'dotenv';

dotenv.config();

/**
 * Algorand Client Class
 */
export class AlgorandClient {
  private algod: algosdk.Algodv2;
  private server: string;
  private token: string;
  private port: string;

  constructor() {
    this.server = process.env.ALGOD_SERVER || 'https://testnet-api.algonode.cloud';
    this.token = process.env.ALGOD_TOKEN || '';
    this.port = process.env.ALGOD_PORT || '';
    
    this.algod = new algosdk.Algodv2(this.token, this.server, this.port);
    
    console.log(`🔗 Algorand client initialized: ${this.server}`);
  }

  /**
   * Get account balance (ALGO and assets)
   * 
   * @param address - Algorand address
   * @returns Account balance information
   */
  async getAccountBalance(address: string): Promise<{ algo: number; assets: any[] }> {
    try {
      if (!algosdk.isValidAddress(address)) {
        throw new Error('Invalid Algorand address');
      }

      const info = await this.algod.accountInformation(address).do();
      
      return {
        algo: Number(info.amount) / 1_000_000, // Convert microALGO to ALGO
        assets: info.assets || []
      };
    } catch (error) {
      console.error('❌ Error getting account balance:', error);
      throw error;
    }
  }

  /**
   * Get transaction parameters
   * 
   * @returns Suggested transaction parameters
   */
  async getTransactionParams(): Promise<algosdk.SuggestedParams> {
    try {
      return await this.algod.getTransactionParams().do();
    } catch (error) {
      console.error('❌ Error getting transaction params:', error);
      throw error;
    }
  }

  /**
   * Build payment transaction
   * 
   * @param from - Sender address
   * @param to - Recipient address
   * @param amount - Amount in ALGO (will be converted to microALGO)
   * @returns Unsigned transaction object
   */
  async buildPaymentTransaction(
    from: string,
    to: string,
    amount: number
  ): Promise<algosdk.Transaction> {
    try {
      if (!algosdk.isValidAddress(from) || !algosdk.isValidAddress(to)) {
        throw new Error('Invalid address');
      }

      const params = await this.getTransactionParams();
      const amountMicroAlgos = Math.floor(amount * 1_000_000);

      const txn = algosdk.makePaymentTxnWithSuggestedParamsFromObject({
        sender: from,
        receiver: to,
        amount: amountMicroAlgos,
        suggestedParams: params,
      });

      return txn;
    } catch (error) {
      console.error('❌ Error building payment transaction:', error);
      throw error;
    }
  }

  /**
   * Send signed transaction
   * 
   * @param signedTxn - Signed transaction blob
   * @returns Transaction ID
   */
  async sendTransaction(signedTxn: Uint8Array): Promise<string> {
    try {
      const result = await this.algod.sendRawTransaction(signedTxn).do();
      return result.txid;
    } catch (error) {
      console.error('❌ Error sending transaction:', error);
      throw error;
    }
  }

  /**
   * Wait for transaction confirmation
   * 
   * @param txid - Transaction ID
   * @param rounds - Number of rounds to wait (default: 4)
   * @returns Confirmed transaction info
   */
  async waitForConfirmation(txid: string, rounds: number = 4): Promise<any> {
    try {
      return await algosdk.waitForConfirmation(this.algod, txid, rounds);
    } catch (error) {
      console.error('❌ Error waiting for confirmation:', error);
      throw error;
    }
  }

  /**
   * Get transaction info
   * 
   * @param txid - Transaction ID
   * @returns Transaction information
   */
  async getTransactionInfo(txid: string): Promise<any> {
    try {
      return await this.algod.pendingTransactionInformation(txid).do();
    } catch (error) {
      console.error('❌ Error getting transaction info:', error);
      throw error;
    }
  }
}

// Export singleton instance
export const algorandClient = new AlgorandClient();

