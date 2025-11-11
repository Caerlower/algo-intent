import { algo, AlgorandClient } from '@algorandfoundation/algokit-utils';
import algosdk from 'algosdk';

export interface TransactionResult {
  status: 'success' | 'error' | 'pending';
  txid?: string;
  message: string;
  error?: string;
}

export interface NFTMetadata {
  name: string;
  unitName: string;
  totalSupply: number;
  description?: string;
  url?: string;
}

export async function getAccountBalance(address: string, algodConfig: any): Promise<{ algo: number; assets: any[] }> {
  if (!algosdk.isValidAddress(address)) throw new Error('Invalid Algorand address');
  const algod = new algosdk.Algodv2(algodConfig.token || '', algodConfig.server, algodConfig.port || '');
  const info = await algod.accountInformation(address).do();
  return {
    algo: Number(info.amount) / 1_000_000,
    assets: info.assets || []
  };
}

export async function sendAlgo(sender: string, recipient: string, amount: number, signer: any, algodConfig: any) {
  if (!algosdk.isValidAddress(sender) || !algosdk.isValidAddress(recipient)) throw new Error('Invalid address');
  const algod = new algosdk.Algodv2(algodConfig.token || '', algodConfig.server, algodConfig.port || '');
  const params = await algod.getTransactionParams().do();
  const txn = algosdk.makePaymentTxnWithSuggestedParamsFromObject({
    from: sender,
    to: recipient,
    amount: Math.floor(amount * 1_000_000),
    suggestedParams: params
  } as any);
  const signedTxn = await signer([txn]);
  const txid = await algod.sendRawTransaction(signedTxn[0].blob).do();
  await algosdk.waitForConfirmation(algod, txid.txid, 4);
  return txid.txid;
}



export async function createNFT(sender: string, metadata: { name: string; unitName: string; totalSupply: number; description?: string; url?: string }, signer: any, algodConfig: any) {
  if (!algosdk.isValidAddress(sender)) throw new Error('Invalid sender address');
  const algod = new algosdk.Algodv2(algodConfig.token || '', algodConfig.server, algodConfig.port || '');
  const params = await algod.getTransactionParams().do();
  const txn = algosdk.makeAssetCreateTxnWithSuggestedParamsFromObject({
    from: sender,
    total: BigInt(metadata.totalSupply),
    decimals: 0,
    assetName: metadata.name.substring(0, 32),
    unitName: metadata.unitName.substring(0, 8),
    manager: sender,
    reserve: sender,
    freeze: sender,
    clawback: sender,
    url: metadata.url || '',
    note: metadata.description ? new TextEncoder().encode(metadata.description) : undefined,
    suggestedParams: params
  } as any);
  const signedTxn = await signer([txn]);
  const txid = await algod.sendRawTransaction(signedTxn[0].blob).do();
  const confirmed = await algosdk.waitForConfirmation(algod, txid.txid, 4);
  const assetId = confirmed['assetIndex'];
  if (typeof assetId !== 'number') throw new Error('Failed to get assetId after NFT creation');
  // Auto-opt-in after creation
  await optInToAsset(sender, assetId, signer, algodConfig);
  return { txid: txid.txid, assetId };
}

export async function optInToAsset(address: string, assetId: number, signer: any, algodConfig: any) {
  if (!algosdk.isValidAddress(address)) throw new Error('Invalid address');
  const algod = new algosdk.Algodv2(algodConfig.token || '', algodConfig.server, algodConfig.port || '');
  const params = await algod.getTransactionParams().do();
  const txn = algosdk.makeAssetTransferTxnWithSuggestedParamsFromObject({
    from: address,
    to: address,
    assetIndex: assetId,
    amount: 0,
    suggestedParams: params
  } as any);
  const signedTxn = await signer([txn]);
  const txid = await algod.sendRawTransaction(signedTxn[0].blob).do();
  await algosdk.waitForConfirmation(algod, txid.txid, 4);
  return txid.txid;
}

export class TransactionService {
  private algorand: AlgorandClient;
  private algodConfig: any;

  constructor(algodConfig: any) {
    this.algorand = AlgorandClient.fromConfig({ algodConfig });
    this.algodConfig = algodConfig;
  }

  async getAccountBalance(address: string): Promise<{ algo: number; assets: any[] }> {
    try {
      if (!this.isValidAddress(address)) {
        throw new Error('Invalid Algorand address');
      }

      // Use algosdk directly with stored configuration
      const algod = new algosdk.Algodv2(
        this.algodConfig.token || '',
        this.algodConfig.server,
        this.algodConfig.port || ''
      );

      const accountInfo = await algod.accountInformation(address).do();

      return {
        algo: Number(accountInfo.amount) / 1_000_000, // Convert from microAlgos to ALGO
        assets: accountInfo.assets || []
      };
    } catch (error) {
      console.error('Error fetching account balance:', error);
      throw new Error(`Failed to fetch account balance: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  // Removed getAccountInformation method due to API compatibility issues

  async sendAlgo(
    sender: string,
    recipient: string,
    amount: number,
    signer: any
  ): Promise<TransactionResult> {
    try {
      // Validate address
      if (!this.isValidAddress(recipient)) {
        return {
          status: 'error',
          message: '❌ Invalid recipient address format.',
          error: 'Invalid address'
        };
      }

      // Send transaction using algokit-utils
      const result = await this.algorand.send.payment({
        signer: signer,
        sender: sender,
        receiver: recipient,
        amount: algo(amount),
      });

      return {
        status: 'success',
        txid: result.txIds[0],
        message: `✅ Transaction successful! ${amount.toFixed(6)} ALGO sent to ${recipient}. Transaction ID: ${result.txIds[0]}`
      };

    } catch (error) {
      return {
        status: 'error',
        message: `❌ Transaction failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }
  
  async createNFT(
    sender: string,
    metadata: NFTMetadata,
    signer: any
  ): Promise<TransactionResult> {
    try {
      if (!metadata.name) {
        return {
          status: 'error',
          message: '❌ NFT name is required.',
          error: 'Missing name'
        };
      }

      // Create NFT using algokit-utils
      const result = await this.algorand.send.assetCreate({
        signer: signer,
        sender: sender,
        assetName: metadata.name.substring(0, 32),
        unitName: metadata.unitName.substring(0, 8),
        total: BigInt(metadata.totalSupply),
        decimals: 0,
        manager: sender,
        reserve: sender,
        freeze: sender,
        clawback: sender,
        url: metadata.url || '',
        note: metadata.description ? new TextEncoder().encode(metadata.description) : undefined,
      });

      // Auto-opt-in to the newly created NFT
      try {
        await this.optInToAsset(sender, Number(result.assetId), signer);
      } catch (optInError) {
        console.warn('Auto-opt-in failed:', optInError);
        // Continue with success message even if opt-in fails
      }

      const supplyText = metadata.totalSupply > 1 ? `${metadata.totalSupply} NFTs` : 'NFT';
      return {
        status: 'success',
        txid: result.txIds[0],
        message: `✅ ${supplyText} created successfully! Asset ID: ${result.assetId}, Name: ${metadata.name}, Total Supply: ${metadata.totalSupply}`
      };

    } catch (error) {
      return {
        status: 'error',
        message: `❌ NFT creation failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  async sendNFT(
    sender: string,
    assetId: number,
    recipient: string,
    signer: any
  ): Promise<TransactionResult> {
    try {
      if (!this.isValidAddress(recipient)) {
        return {
          status: 'error',
          message: '❌ Invalid recipient address format.',
          error: 'Invalid address'
        };
      }

      // Transfer NFT using algokit-utils
      const result = await this.algorand.send.assetTransfer({
        signer: signer,
        sender: sender,
        receiver: recipient,
        assetId: BigInt(assetId),
        amount: 1n,
      });

      return {
        status: 'success',
        txid: result.txIds[0],
        message: `✅ NFT transferred successfully! Asset ID: ${assetId} sent to ${recipient}`
      };

    } catch (error) {
      return {
        status: 'error',
        message: `❌ NFT transfer failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  async optInToAsset(
    sender: string,
    assetId: number,
    signer: any
  ): Promise<TransactionResult> {
    try {
      // Opt-in using algokit-utils
      const result = await this.algorand.send.assetOptIn({
        signer: signer,
        sender: sender,
        assetId: BigInt(assetId),
      });

      return {
        status: 'success',
        txid: result.txIds[0],
        message: `✅ Successfully opted in to asset ${assetId}`
      };

    } catch (error) {
      return {
        status: 'error',
        message: `❌ Opt-in failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  async optOutOfAsset(
    sender: string,
    assetId: number,
    signer: any
  ): Promise<TransactionResult> {
    try {
      // Opt-out using algokit-utils
      const result = await this.algorand.send.assetOptOut({
        signer: signer,
        sender: sender,
        assetId: BigInt(assetId),
        ensureZeroBalance: true,
      });

      return {
        status: 'success',
        txid: result.txIds[0],
        message: `✅ Successfully opted out of asset ${assetId}`
      };

    } catch (error) {
      return {
        status: 'error',
        message: `❌ Opt-out failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Execute multiple transactions atomically using AtomicTransactionComposer
   * All transactions must succeed or all will fail
   */
  async executeAtomicTransactions(
    sender: string,
    transactions: Array<{
      type: 'send_algo' | 'send_asset' | 'opt_in' | 'opt_out' | 'send_nft';
      params: {
        recipient?: string;
        amount?: number;
        assetId?: number;
        assetName?: string; // For display purposes
      };
    }>,
    signer: any
  ): Promise<TransactionResult> {
    try {
      if (transactions.length === 0) {
        return {
          status: 'error',
          message: '❌ No transactions to execute',
          error: 'Empty transactions array'
        };
      }

      // Get algod client
      const algod = new algosdk.Algodv2(
        this.algodConfig.token || '',
        this.algodConfig.server,
        this.algodConfig.port || ''
      );

      // Get suggested params once for all transactions
      const suggestedParams = await algod.getTransactionParams().do();

      // Create AtomicTransactionComposer
      const atc = new algosdk.AtomicTransactionComposer();

      // Build each transaction and add to composer
      for (const txn of transactions) {
        let transaction: algosdk.Transaction;

        switch (txn.type) {
          case 'send_algo':
            if (!txn.params.recipient || txn.params.amount === undefined || txn.params.amount === null || isNaN(txn.params.amount)) {
              return {
                status: 'error',
                message: '❌ Missing recipient or invalid amount for ALGO transfer',
                error: 'Invalid parameters'
              };
            }
            if (!this.isValidAddress(txn.params.recipient)) {
              return {
                status: 'error',
                message: '❌ Invalid recipient address format',
                error: 'Invalid address'
              };
            }
            const algoAmount = Number(txn.params.amount);
            if (isNaN(algoAmount) || algoAmount <= 0) {
              return {
                status: 'error',
                message: '❌ Invalid amount for ALGO transfer',
                error: 'Invalid amount'
              };
            }
            transaction = algosdk.makePaymentTxnWithSuggestedParamsFromObject({
              sender: sender,
              receiver: txn.params.recipient,
              amount: Math.floor(algoAmount * 1_000_000), // Convert to microALGO
              suggestedParams,
              note: new TextEncoder().encode(`Atomic transfer: ${algoAmount} ALGO to ${txn.params.recipient}`)
            });
            break;

          case 'send_asset':
            if (!txn.params.recipient || txn.params.amount === undefined || txn.params.amount === null || isNaN(txn.params.amount) || !txn.params.assetId) {
              return {
                status: 'error',
                message: '❌ Missing recipient, amount, or asset ID for asset transfer',
                error: 'Invalid parameters'
              };
            }
            if (!this.isValidAddress(txn.params.recipient)) {
              return {
                status: 'error',
                message: '❌ Invalid recipient address format',
                error: 'Invalid address'
              };
            }
            const assetAmount = Number(txn.params.amount);
            if (isNaN(assetAmount) || assetAmount <= 0) {
              return {
                status: 'error',
                message: '❌ Invalid amount for asset transfer',
                error: 'Invalid amount'
              };
            }
            // Get asset info to determine decimals
            let decimals = 0;
            try {
              const assetInfo = await algod.getAssetByID(txn.params.assetId).do();
              decimals = assetInfo.params?.decimals || 0;
            } catch (error) {
              console.warn(`Could not fetch asset info for ${txn.params.assetId}, using default decimals:`, error);
              // Default to 6 decimals for most assets (USDC, USDT, etc.)
              decimals = 6;
            }
            const assetAmountMicro = Math.floor(assetAmount * Math.pow(10, decimals));
            
            transaction = algosdk.makeAssetTransferTxnWithSuggestedParamsFromObject({
              sender: sender,
              receiver: txn.params.recipient,
              amount: assetAmountMicro,
              assetIndex: txn.params.assetId,
              suggestedParams,
              note: new TextEncoder().encode(`Atomic transfer: ${assetAmount} ${txn.params.assetName || `Asset ${txn.params.assetId}`} to ${txn.params.recipient}`)
            });
            break;

          case 'opt_in':
            if (!txn.params.assetId) {
              return {
                status: 'error',
                message: '❌ Missing asset ID for opt-in',
                error: 'Invalid parameters'
              };
            }
            transaction = algosdk.makeAssetTransferTxnWithSuggestedParamsFromObject({
              sender: sender,
              receiver: sender, // Opt-in: sender sends to themselves
              amount: 0,
              assetIndex: txn.params.assetId,
              suggestedParams,
              note: new TextEncoder().encode(`Atomic opt-in to asset ${txn.params.assetId}`)
            });
            break;

          case 'opt_out':
            if (!txn.params.assetId) {
              return {
                status: 'error',
                message: '❌ Missing asset ID for opt-out',
                error: 'Invalid parameters'
              };
            }
            // Opt-out: send to zero address with closeRemainderTo
            const zeroAddress = 'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAY5HFKQ';
            transaction = algosdk.makeAssetTransferTxnWithSuggestedParamsFromObject({
              sender: sender,
              receiver: zeroAddress,
              amount: 0,
              assetIndex: txn.params.assetId,
              closeRemainderTo: zeroAddress,
              suggestedParams,
              note: new TextEncoder().encode(`Atomic opt-out from asset ${txn.params.assetId}`)
            });
            break;

          case 'send_nft':
            if (!txn.params.recipient || !txn.params.assetId) {
              return {
                status: 'error',
                message: '❌ Missing recipient or asset ID for NFT transfer',
                error: 'Invalid parameters'
              };
            }
            if (!this.isValidAddress(txn.params.recipient)) {
              return {
                status: 'error',
                message: '❌ Invalid recipient address format',
                error: 'Invalid address'
              };
            }
            transaction = algosdk.makeAssetTransferTxnWithSuggestedParamsFromObject({
              sender: sender,
              receiver: txn.params.recipient,
              amount: 1, // NFTs have amount 1
              assetIndex: txn.params.assetId,
              suggestedParams,
              note: new TextEncoder().encode(`Atomic NFT transfer: asset ${txn.params.assetId} to ${txn.params.recipient}`)
            });
            break;

          default:
            return {
              status: 'error',
              message: `❌ Unsupported transaction type: ${(txn as any).type}`,
              error: 'Unsupported type'
            };
        }

        // Add transaction to atomic composer
        atc.addTransaction({
          txn: transaction,
          signer: signer
        });
      }

      // Execute the atomic group
      const result = await atc.execute(algod, 5);

      // Build success message
      const actionDescriptions = transactions.map(txn => {
        switch (txn.type) {
          case 'send_algo':
            return `sent ${txn.params.amount} ALGO to ${txn.params.recipient?.substring(0, 6)}...${txn.params.recipient?.substring(txn.params.recipient.length - 4)}`;
          case 'send_asset':
            const assetName = txn.params.assetName || `Asset ${txn.params.assetId}`;
            return `sent ${txn.params.amount} ${assetName} to ${txn.params.recipient?.substring(0, 6)}...${txn.params.recipient?.substring(txn.params.recipient.length - 4)}`;
          case 'opt_in':
            return `opted in to asset ${txn.params.assetId}`;
          case 'opt_out':
            return `opted out of asset ${txn.params.assetId}`;
          case 'send_nft':
            return `sent NFT ${txn.params.assetId} to ${txn.params.recipient?.substring(0, 6)}...${txn.params.recipient?.substring(txn.params.recipient.length - 4)}`;
          default:
            return 'completed action';
        }
      }).join(', ');

      return {
        status: 'success',
        txid: result.txIDs[0], // First transaction ID represents the group
        message: `✅ Atomic transaction successful! ${actionDescriptions}.`
      };

    } catch (error) {
      console.error('Atomic transaction error:', error);
      return {
        status: 'error',
        message: `❌ Atomic transaction failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  private isValidAddress(address: string): boolean {
    // Simple Algorand address validation (58 characters, base32)
    const addressRegex = /^[A-Z2-7]{58}$/;
    return addressRegex.test(address);
  }
} 