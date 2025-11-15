import { algo, AlgorandClient } from '@algorandfoundation/algokit-utils';
import type { TransactionSignerAccount } from '@algorandfoundation/algokit-utils/types/account';
import algosdk, { Address, TransactionSigner } from 'algosdk';
import { phoneNumberService } from './phoneNumberService';
import { isPhoneNumber, isValidPhoneNumberStrict, normalizePhoneNumber } from '../utils/phoneNumberUtils';

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
  const extendedParams = {
    ...(params as any),
    lastRound: ((params as any).lastRound ?? 0) + 60,
  };
  const txn = algosdk.makePaymentTxnWithSuggestedParamsFromObject({
    from: sender,
    to: recipient,
    amount: Math.floor(amount * 1_000_000),
    suggestedParams: extendedParams
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
  const extendedParams = {
    ...(params as any),
    lastRound: ((params as any).lastRound ?? 0) + 60,
  };
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
    suggestedParams: extendedParams
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
  const extendedParams = {
    ...(params as any),
    lastRound: ((params as any).lastRound ?? 0) + 60,
  };
  const txn = algosdk.makeAssetTransferTxnWithSuggestedParamsFromObject({
    from: address,
    to: address,
    assetIndex: assetId,
    amount: 0,
    suggestedParams: extendedParams
  } as any);
  const signedTxn = await signer([txn]);
  const txid = await algod.sendRawTransaction(signedTxn[0].blob).do();
  await algosdk.waitForConfirmation(algod, txid.txid, 4);
  return txid.txid;
}

export class TransactionService {
  private algorand: AlgorandClient;
  private algodConfig: any;

  private resolveSigner(
    signer: TransactionSigner | TransactionSignerAccount | undefined,
    sender: string
  ): TransactionSignerAccount {
    if (!signer) {
      throw new Error('No active wallet signer available');
    }

    if (typeof signer === 'function') {
      return { addr: sender as unknown as Address, signer };
    }

    if (typeof signer === 'object' && typeof signer.signer === 'function') {
      return {
        addr: ((signer.addr as unknown as Address) ?? (sender as unknown as Address)) as Address,
        signer: signer.signer,
      };
    }

    throw new Error('Unsupported signer type provided');
  }

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
    signer: TransactionSigner | TransactionSignerAccount | undefined
  ): Promise<TransactionResult> {
    try {
      let recipientAddress = recipient;
      let recipientDisplay = recipient;

      // Check if recipient is a phone number
      if (isPhoneNumber(recipient)) {
        // Validate phone number format strictly (reject short numbers)
        const normalized = normalizePhoneNumber(recipient);
        if (!normalized || !isValidPhoneNumberStrict(normalized)) {
          return {
            status: 'error',
            message: '❌ Invalid phone number format. Phone numbers must be in international format (e.g., +1234567890) with at least 9 digits.',
            error: 'Invalid phone number'
          };
        }

        try {
          // Resolve phone number to wallet address via Hashi
          recipientAddress = await phoneNumberService.resolvePhoneNumberToAddress(normalized);
          recipientDisplay = normalized; // Show phone number in success message
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : 'Unknown error';
          return {
            status: 'error',
            message: `❌ Failed to resolve phone number: ${errorMessage}`,
            error: errorMessage
          };
        }
      } else {
        // Validate Algorand address format
        if (!this.isValidAddress(recipient)) {
          return {
            status: 'error',
            message: '❌ Invalid recipient. Must be a valid Algorand address or phone number (e.g., +1234567890).',
            error: 'Invalid address or phone number'
          };
        }
      }

      const signerAccount = this.resolveSigner(signer, sender);

      // Send transaction using algokit-utils
      const result = await this.algorand.send.payment({
        signer: signerAccount,
        sender: sender,
        receiver: recipientAddress,
        amount: algo(amount),
        validityWindow: 60n,
        maxRoundsToWaitForConfirmation: 20,
      });

      // Format recipient display
      const displayRecipient = isPhoneNumber(recipient) 
        ? recipientDisplay 
        : `${recipientAddress.substring(0, 6)}...${recipientAddress.substring(recipientAddress.length - 4)}`;

      return {
        status: 'success',
        txid: result.txIds[0],
        message: `✅ Transaction successful! ${amount.toFixed(6)} ALGO sent to ${displayRecipient}. Transaction ID: ${result.txIds[0]}`
      };

    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (message.includes('User rejected the signing request')) {
        return {
          status: 'error',
          message: '❌ Transaction cancelled by the user.',
          error: 'cancelled_by_user'
        };
      }
      return {
        status: 'error',
        message: `❌ Transaction failed: ${message}`,
        error: message
      };
    }
  }
  
  async createNFT(
    sender: string,
    metadata: NFTMetadata,
    signer: TransactionSigner | TransactionSignerAccount | undefined
  ): Promise<TransactionResult> {
    try {
      if (!metadata.name) {
        return {
          status: 'error',
          message: '❌ NFT name is required.',
          error: 'Missing name'
        };
      }

      const signerAccount = this.resolveSigner(signer, sender);

      // Create NFT using algokit-utils
      const result = await this.algorand.send.assetCreate({
        signer: signerAccount,
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
        validityWindow: 60n,
        maxRoundsToWaitForConfirmation: 20,
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
      const message = error instanceof Error ? error.message : String(error);
      if (message.includes('User rejected the signing request')) {
        return {
          status: 'error',
          message: '❌ NFT creation cancelled by the user.',
          error: 'cancelled_by_user'
        };
      }
      return {
        status: 'error',
        message: `❌ NFT creation failed: ${message}`,
        error: message
      };
    }
  }

  async sendNFT(
    sender: string,
    assetId: number,
    recipient: string,
    signer: TransactionSigner | TransactionSignerAccount | undefined,
    quantity = 1,
    assetName?: string
  ): Promise<TransactionResult> {
    try {
      if (!this.isValidAddress(recipient)) {
        return {
          status: 'error',
          message: '❌ Invalid recipient address format.',
          error: 'Invalid address'
        };
      }

      const signerAccount = this.resolveSigner(signer, sender);

      const algod = new algosdk.Algodv2(
        this.algodConfig.token || '',
        this.algodConfig.server,
        this.algodConfig.port || ''
      );

      let resolvedAssetName = assetName;
      try {
        const assetInfo = await algod.getAssetByID(assetId).do();
        resolvedAssetName =
          resolvedAssetName ||
          assetInfo.params?.name ||
          assetInfo.params?.unitName ||
          undefined;
      } catch (err) {
        console.warn(`Unable to fetch asset ${assetId} metadata`, err);
      }

      const transferResult = await this.sendAsset(
        sender,
        assetId,
        quantity,
        recipient,
        signerAccount,
        resolvedAssetName
      );

      if (transferResult.status === 'success') {
        return {
          status: 'success',
          txid: transferResult.txid,
          message: '✅ NFT transferred successfully!',
        };
      }

      return transferResult;

    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (message.includes('User rejected the signing request')) {
        return {
          status: 'error',
          message: '❌ NFT transfer cancelled by the user.',
          error: 'cancelled_by_user'
        };
      }
      return {
        status: 'error',
        message: `❌ NFT transfer failed: ${message}`,
        error: message
      };
    }
  }

  async sendAsset(
    sender: string,
    assetId: number,
    amount: number,
    recipient: string,
    signer: TransactionSigner | TransactionSignerAccount | undefined,
    assetName?: string
  ): Promise<TransactionResult> {
    try {
      let recipientAddress = recipient;
      let recipientDisplay = recipient;

      // Check if recipient is a phone number
      if (isPhoneNumber(recipient)) {
        // Validate phone number format strictly (reject short numbers)
        const normalized = normalizePhoneNumber(recipient);
        if (!normalized || !isValidPhoneNumberStrict(normalized)) {
          return {
            status: 'error',
            message: '❌ Invalid phone number format. Phone numbers must be in international format (e.g., +1234567890) with at least 9 digits.',
            error: 'Invalid phone number'
          };
        }

        try {
          // Resolve phone number to wallet address via Hashi
          recipientAddress = await phoneNumberService.resolvePhoneNumberToAddress(normalized);
          recipientDisplay = normalized; // Show phone number in success message
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : 'Unknown error';
          return {
            status: 'error',
            message: `❌ Failed to resolve phone number: ${errorMessage}`,
            error: errorMessage
          };
        }
      } else {
        // Validate Algorand address format
        if (!this.isValidAddress(recipient)) {
          return {
            status: 'error',
            message: '❌ Invalid recipient. Must be a valid Algorand address or phone number (e.g., +1234567890).',
            error: 'Invalid address or phone number'
          };
        }
      }

      if (amount <= 0 || Number.isNaN(amount)) {
        return {
          status: 'error',
          message: '❌ Invalid amount specified for asset transfer.',
          error: 'Invalid amount'
        };
      }

      const signerAccount = this.resolveSigner(signer, sender);

      const algod = new algosdk.Algodv2(
        this.algodConfig.token || '',
        this.algodConfig.server,
        this.algodConfig.port || ''
      );

      let decimals = 0;
      try {
        const assetInfo = await algod.getAssetByID(assetId).do();
        decimals = assetInfo.params?.decimals || 0;
      } catch (error) {
        console.warn(`Could not fetch asset info for ${assetId}, defaulting decimals to 6`, error);
        decimals = 6;
      }

      const scaledAmount = BigInt(Math.floor(amount * Math.pow(10, decimals)));

      // Ensure sender has opted in and has sufficient balance
      try {
        const holding: any = await algod.accountAssetInformation(sender, assetId).do();
        const senderBalance =
          BigInt(holding.assetHolding?.amount ?? holding['asset-holding']?.amount ?? holding.amount ?? 0);
        if (senderBalance < scaledAmount) {
          return {
            status: 'error',
            message: `❌ Insufficient ${assetName || `asset ${assetId}`} balance to send ${amount}.`,
            error: 'insufficient_asset_balance'
          };
        }
      } catch (err: any) {
        const status = err?.statusCode ?? err?.response?.status;
        if (status === 404) {
          return {
            status: 'error',
            message: `❌ You must opt in to ${assetName || `asset ${assetId}`} before sending it.`,
            error: 'sender_not_opted_in'
          };
        }
        throw err;
      }

      // Ensure recipient is opted in
      try {
        await algod.accountAssetInformation(recipientAddress, assetId).do();
      } catch (err: any) {
        const status = err?.statusCode ?? err?.response?.status;
        if (status === 404) {
          return {
            status: 'error',
            message: `❌ Recipient must opt in to ${assetName || `asset ${assetId}`} before receiving it.`,
            error: 'recipient_not_opted_in'
          };
        }
        throw err;
      }

      const result = await this.algorand.send.assetTransfer({
        signer: signerAccount,
        sender: sender,
        receiver: recipientAddress,
        assetId: BigInt(assetId),
        amount: scaledAmount,
        validityWindow: 60n,
        maxRoundsToWaitForConfirmation: 20,
      });

      // Format recipient display
      const displayRecipient = isPhoneNumber(recipient) 
        ? recipientDisplay 
        : `${recipientAddress.substring(0, 6)}...${recipientAddress.substring(recipientAddress.length - 4)}`;

      return {
        status: 'success',
        txid: result.txIds[0],
        message: `✅ Sent ${amount} ${assetName || `asset ${assetId}`} to ${displayRecipient}`
      };

    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (message.includes('User rejected the signing request')) {
        return {
          status: 'error',
          message: '❌ Asset transfer cancelled by the user.',
          error: 'cancelled_by_user'
        };
      }
      return {
        status: 'error',
        message: `❌ Asset transfer failed: ${message}`,
        error: message
      };
    }
  }

  async getAssetMetadata(assetId: number): Promise<{ name?: string; unitName?: string } | null> {
    try {
      const algod = new algosdk.Algodv2(
        this.algodConfig.token || '',
        this.algodConfig.server,
        this.algodConfig.port || ''
      );
      const assetInfo = await algod.getAssetByID(assetId).do();
      return {
        name: assetInfo.params?.name,
        unitName: assetInfo.params?.unitName,
      };
    } catch (error) {
      console.warn(`Failed to fetch metadata for asset ${assetId}`, error);
      return null;
    }
  }

  async optInToAsset(
    sender: string,
    assetId: number,
    signer: TransactionSigner | TransactionSignerAccount | undefined
  ): Promise<TransactionResult> {
    try {
      const signerAccount = this.resolveSigner(signer, sender);

      // Opt-in using algokit-utils
      const result = await this.algorand.send.assetOptIn({
        signer: signerAccount,
        sender: sender,
        assetId: BigInt(assetId),
        validityWindow: 60n,
        maxRoundsToWaitForConfirmation: 20,
      });

      return {
        status: 'success',
        txid: result.txIds[0],
        message: `✅ Successfully opted in to asset ${assetId}`
      };

    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (message.includes('User rejected the signing request')) {
        return {
          status: 'error',
          message: '❌ Asset opt-in cancelled by the user.',
          error: 'cancelled_by_user'
        };
      }
      return {
        status: 'error',
        message: `❌ Opt-in failed: ${message}`,
        error: message
      };
    }
  }

  async optOutOfAsset(
    sender: string,
    assetId: number,
    signer: TransactionSigner | TransactionSignerAccount | undefined
  ): Promise<TransactionResult> {
    try {
      const signerAccount = this.resolveSigner(signer, sender);

      // Opt-out using algokit-utils
      const result = await this.algorand.send.assetOptOut({
        signer: signerAccount,
        sender: sender,
        assetId: BigInt(assetId),
        ensureZeroBalance: true,
        validityWindow: 60n,
        maxRoundsToWaitForConfirmation: 20,
      });

      return {
        status: 'success',
        txid: result.txIds[0],
        message: `✅ Successfully opted out of asset ${assetId}`
      };

    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (message.includes('User rejected the signing request')) {
        return {
          status: 'error',
          message: '❌ Asset opt-out cancelled by the user.',
          error: 'cancelled_by_user'
        };
      }
      return {
        status: 'error',
        message: `❌ Opt-out failed: ${message}`,
        error: message
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
    signer: TransactionSigner | TransactionSignerAccount | undefined
  ): Promise<TransactionResult> {
    try {
      if (transactions.length === 0) {
        return {
          status: 'error',
          message: '❌ No transactions to execute',
          error: 'Empty transactions array'
        };
      }

      const signerAccount = this.resolveSigner(signer, sender);

      // Get algod client
      const algod = new algosdk.Algodv2(
        this.algodConfig.token || '',
        this.algodConfig.server,
        this.algodConfig.port || ''
      );

      // Get suggested params once for all transactions
      const suggestedParams = await algod.getTransactionParams().do();
      const extendedParams = {
        ...(suggestedParams as any),
        lastRound: ((suggestedParams as any).lastRound ?? 0) + 60,
      };

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
              suggestedParams: extendedParams
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

              // Ensure sender is opted in and has sufficient balance
              try {
                const holding: any = await algod.accountAssetInformation(sender, txn.params.assetId).do();
                const senderBalance =
                  holding.assetHolding?.amount ??
                  holding['asset-holding']?.amount ??
                  holding.amount ??
                  0;
                const requiredAmount = Math.floor(assetAmount * Math.pow(10, decimals));
                if (senderBalance < requiredAmount) {
                  return {
                    status: 'error',
                    message: `❌ Insufficient ${txn.params.assetName || `asset ${txn.params.assetId}`} balance to send ${assetAmount}.`,
                    error: 'insufficient_asset_balance'
                  };
                }
              } catch (err: any) {
                const status = err?.statusCode ?? err?.response?.status;
                if (status === 404) {
                  return {
                    status: 'error',
                    message: `❌ You must opt in to ${txn.params.assetName || `asset ${txn.params.assetId}`} before sending it.`,
                    error: 'sender_not_opted_in'
                  };
                }
                throw err;
              }

              // Ensure recipient is opted in
              try {
                await algod.accountAssetInformation(txn.params.recipient, txn.params.assetId).do();
              } catch (err: any) {
                const status = err?.statusCode ?? err?.response?.status;
                if (status === 404) {
                  return {
                    status: 'error',
                    message: `❌ Recipient must opt in to ${txn.params.assetName || `asset ${txn.params.assetId}`} before receiving it.`,
                    error: 'recipient_not_opted_in'
                  };
                }
                throw err;
              }
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
              suggestedParams: extendedParams
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
              suggestedParams: extendedParams
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
              suggestedParams: extendedParams
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
              suggestedParams: extendedParams
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
          signer: signerAccount.signer
        });
      }

      // Execute the atomic group
      const result = await atc.execute(algod, 5);

      // Build success message
      const actionDescriptions = transactions.map((txn, index) => {
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

      const perTxnFee = Number(extendedParams.fee || extendedParams.minFee || 1000);
      const totalFeeMicro = perTxnFee * transactions.length;
      const totalFee = (totalFeeMicro / 1_000_000).toLocaleString(undefined, { maximumFractionDigits: 6 });

      return {
        status: 'success',
        txid: result.txIDs[0], // First transaction ID represents the group
        message: `✅ Atomic transaction successful! ${actionDescriptions}. Total fee: ${totalFee} ALGO.`,
        error: undefined,
      };

    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (message.includes('User rejected the signing request')) {
        return {
          status: 'error',
          message: '❌ Transaction cancelled by the user.',
          error: 'cancelled_by_user'
        };
      }
      console.error('Atomic transaction error:', error);
      return {
        status: 'error',
        message: `❌ Atomic transaction failed: ${message}`,
        error: message
      };
    }
  }

  private isValidAddress(address: string): boolean {
    // Simple Algorand address validation (58 characters, base32)
    const addressRegex = /^[A-Z2-7]{58}$/;
    return addressRegex.test(address);
  }
} 