/**
 * Transaction Executor
 * 
 * Executes Algorand transactions based on parsed intents
 * Handles: send_algo, balance, opt_in, etc.
 */

import { ParsedIntent } from '../intent/types';
import { algorandClient } from '../algorand/algorandClient';
import { walletManager } from '../wallet/walletManager';
import algosdk from 'algosdk';

export interface TransactionResult {
  success: boolean;
  txid?: string;
  message: string;
  error?: string;
}

/**
 * Execute transaction based on parsed intent
 * 
 * @param intent - Parsed intent from AlgoIntent engine
 * @param phoneNumber - User's phone number
 * @returns Transaction result
 */
export async function executeTransaction(
  intent: ParsedIntent,
  phoneNumber: string
): Promise<TransactionResult> {
  try {
    console.log(`🚀 Executing transaction for intent: ${intent.intent}`);

    switch (intent.intent) {
      case 'send_algo':
        return await executeSendAlgo(intent, phoneNumber);
      
      case 'balance':
        return await executeBalance(intent, phoneNumber);
      
      case 'opt_in':
        return await executeOptIn(intent, phoneNumber);
      
      case 'send_algo_multi':
        return await executeSendAlgoMulti(intent, phoneNumber);
      
      default:
        return {
          success: false,
          message: `❌ Intent "${intent.intent}" is not yet supported`,
          error: `Unsupported intent: ${intent.intent}`
        };
    }
  } catch (error) {
    console.error('❌ Transaction execution error:', error);
    return {
      success: false,
      message: `❌ Transaction failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

/**
 * Execute send_algo transaction
 */
async function executeSendAlgo(
  intent: ParsedIntent,
  phoneNumber: string
): Promise<TransactionResult> {
  const { amount, recipient } = intent.parameters;

  if (!amount || !recipient) {
    return {
      success: false,
      message: '❌ Missing required parameters: amount and recipient',
      error: 'Missing parameters'
    };
  }

  try {
    // Get or create sender wallet
    const senderWallet = await walletManager.getOrCreateWallet(phoneNumber);

    // For demo: If recipient is a phone number, resolve to address
    // TODO: Implement phone number to address resolution
    let recipientAddress = recipient;
    
    // Check if recipient is a phone number (starts with +)
    if (recipient.startsWith('+')) {
      // For demo: create wallet for recipient if doesn't exist
      const recipientWallet = await walletManager.getOrCreateWallet(recipient);
      recipientAddress = recipientWallet.address;
      console.log(`📱 Resolved phone ${recipient} to address ${recipientAddress}`);
    }

    // Validate recipient address
    if (!algosdk.isValidAddress(recipientAddress)) {
      return {
        success: false,
        message: `❌ Invalid recipient address: ${recipient}`,
        error: 'Invalid address'
      };
    }

    // Check sender balance
    const balance = await algorandClient.getAccountBalance(senderWallet.address);
    if (balance.algo < amount + 0.001) { // 0.001 ALGO for transaction fee
      return {
        success: false,
        message: `❌ Insufficient balance. Available: ${balance.algo.toFixed(6)} ALGO, Required: ${(amount + 0.001).toFixed(6)} ALGO`,
        error: 'Insufficient balance'
      };
    }

    // Build transaction
    const txn = await algorandClient.buildPaymentTransaction(
      senderWallet.address,
      recipientAddress,
      amount
    );

    // Sign transaction
    const signedTxn = await walletManager.signTransaction(txn, phoneNumber);

    // Send transaction
    const txid = await algorandClient.sendTransaction(signedTxn);

    // Wait for confirmation
    await algorandClient.waitForConfirmation(txid, 4);

    // Use Pera Wallet explorer
    const explorerUrl = `https://testnet.explorer.perawallet.app/tx/${txid}`;

    return {
      success: true,
      txid,
      message: `✅ Sent ${amount} ALGO to ${recipient.startsWith('+') ? recipient : recipientAddress.substring(0, 8) + '...'}\n\nTxID: ${txid}\n\nView transaction:\n${explorerUrl}`
    };
  } catch (error) {
    console.error('❌ Error executing send_algo:', error);
    return {
      success: false,
      message: `❌ Transaction failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

/**
 * Execute balance check
 */
async function executeBalance(
  intent: ParsedIntent,
  phoneNumber: string
): Promise<TransactionResult> {
  try {
    // Get or create wallet
    const wallet = await walletManager.getOrCreateWallet(phoneNumber);

    // Get balance
    const balance = await algorandClient.getAccountBalance(wallet.address);

    return {
      success: true,
      message: `💰 Your balance:\n\nALGO: ${balance.algo.toFixed(6)}\nAssets: ${balance.assets.length}\n\nAddress: ${wallet.address}`
    };
  } catch (error) {
    console.error('❌ Error checking balance:', error);
    return {
      success: false,
      message: `❌ Failed to check balance: ${error instanceof Error ? error.message : 'Unknown error'}`,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

/**
 * Execute opt-in transaction
 */
async function executeOptIn(
  intent: ParsedIntent,
  phoneNumber: string
): Promise<TransactionResult> {
  const { asset_id } = intent.parameters;

  if (!asset_id) {
    return {
      success: false,
      message: '❌ Missing required parameter: asset_id',
      error: 'Missing asset_id'
    };
  }

  try {
    // Get or create wallet
    const wallet = await walletManager.getOrCreateWallet(phoneNumber);

    // Get transaction params
    const params = await algorandClient.getTransactionParams();

    // Build opt-in transaction
    const txn = algosdk.makeAssetTransferTxnWithSuggestedParamsFromObject({
      sender: wallet.address,
      receiver: wallet.address, // Opt-in: send to self
      amount: 0,
      assetIndex: Number(asset_id),
      suggestedParams: params,
    });

    // Sign transaction
    const signedTxn = await walletManager.signTransaction(txn, phoneNumber);

    // Send transaction
    const txid = await algorandClient.sendTransaction(signedTxn);

    // Wait for confirmation
    await algorandClient.waitForConfirmation(txid, 4);

    // Use Pera Wallet explorer
    const explorerUrl = `https://testnet.explorer.perawallet.app/tx/${txid}`;

    return {
      success: true,
      txid,
      message: `✅ Opted-in to asset ${asset_id}\n\nTxID: ${txid}\n\nView transaction:\n${explorerUrl}`
    };
  } catch (error) {
    console.error('❌ Error executing opt_in:', error);
    return {
      success: false,
      message: `❌ Opt-in failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

/**
 * Execute multi-recipient send_algo transaction
 */
async function executeSendAlgoMulti(
  intent: ParsedIntent,
  phoneNumber: string
): Promise<TransactionResult> {
  const { recipients } = intent.parameters;

  if (!recipients || !Array.isArray(recipients) || recipients.length === 0) {
    return {
      success: false,
      message: '❌ Missing required parameter: recipients array',
      error: 'Missing recipients'
    };
  }

  try {
    // Get or create sender wallet
    const senderWallet = await walletManager.getOrCreateWallet(phoneNumber);

    // Check total amount needed
    const totalAmount = recipients.reduce((sum, r: any) => sum + (r.amount || 0), 0);
    const balance = await algorandClient.getAccountBalance(senderWallet.address);
    
    if (balance.algo < totalAmount + 0.001 * recipients.length) {
      return {
        success: false,
        message: `❌ Insufficient balance. Available: ${balance.algo.toFixed(6)} ALGO, Required: ${(totalAmount + 0.001 * recipients.length).toFixed(6)} ALGO`,
        error: 'Insufficient balance'
      };
    }

      // Build transactions for each recipient
      const txns: algosdk.Transaction[] = [];
      for (const recipient of recipients) {
        let recipientAddress = recipient.address;
      
      // Resolve phone number to address if needed
      if (recipientAddress.startsWith('+')) {
        const recipientWallet = await walletManager.getOrCreateWallet(recipientAddress);
        recipientAddress = recipientWallet.address;
      }

      if (!algosdk.isValidAddress(recipientAddress)) {
        throw new Error(`Invalid recipient address: ${recipientAddress}`);
      }

      const txn = await algorandClient.buildPaymentTransaction(
        senderWallet.address,
        recipientAddress,
        recipient.amount
      );
      txns.push(txn);
    }

    // Sign all transactions
    const signedTxns: Uint8Array[] = [];
    for (const txn of txns) {
      const signed = await walletManager.signTransaction(txn, phoneNumber);
      signedTxns.push(signed);
    }

      // Send all transactions
      const txids: string[] = [];
      for (const signedTxn of signedTxns) {
        const txid = await algorandClient.sendTransaction(signedTxn);
        txids.push(txid);
        await algorandClient.waitForConfirmation(txid, 4);
      }

      // Generate explorer links using Pera Wallet explorer
      const explorerLinks = txids.map((txid, i) => {
        return `${i + 1}. ${txid}\n   https://testnet.explorer.perawallet.app/tx/${txid}`;
      }).join('\n\n');

      return {
        success: true,
        txid: txids[0], // Return first txid
        message: `✅ Sent ${recipients.length} transactions\n\nTxIDs:\n\n${explorerLinks}`
      };
  } catch (error) {
    console.error('❌ Error executing send_algo_multi:', error);
    return {
      success: false,
      message: `❌ Multi-send failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

