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
import { downloadMedia, uploadMediaToIpfs } from '../whatsapp/media';

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
      
      case 'wallet_address':
        return await executeWalletAddress(intent, phoneNumber);
      
      case 'account_activity':
        return await executeAccountActivity(intent, phoneNumber);
      
      case 'opt_in':
        return await executeOptIn(intent, phoneNumber);
      
      case 'send_algo_multi':
        return await executeSendAlgoMulti(intent, phoneNumber);

    case 'send_nft':
      return await executeSendNft(intent, phoneNumber);

    case 'send_nft_multi':
      return await executeSendNftMulti(intent, phoneNumber);

    case 'create_nft':
    case 'create_nft_with_image':
      return await executeCreateNft(intent, phoneNumber);

    case 'opt_out':
      return await executeOptOut(intent, phoneNumber);
      
      default:
        return {
          success: false,
          message: `❌ Transaction intent "${intent.intent}" is not supported`,
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

    // Use Lora AlgoKit explorer
    const explorerUrl = `https://lora.algokit.io/testnet/transaction/${txid}`;

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
 * Execute wallet address query
 */
async function executeWalletAddress(
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
      message: `🔑 Your Wallet Address:\n${wallet.address}\n\n💰 Balance:\nALGO: ${balance.algo.toFixed(6)}\nAssets: ${balance.assets.length}`
    };
  } catch (error) {
    console.error('❌ Error getting wallet address:', error);
    return {
      success: false,
      message: `❌ Failed to get wallet address: ${error instanceof Error ? error.message : 'Unknown error'}`,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

/**
 * Execute account activity query
 */
async function executeAccountActivity(
  intent: ParsedIntent,
  phoneNumber: string
): Promise<TransactionResult> {
  try {
    // Get or create wallet
    const wallet = await walletManager.getOrCreateWallet(phoneNumber);

    // Generate account activity link
    const accountUrl = `https://lora.algokit.io/testnet/account/${wallet.address}`;

    return {
      success: true,
      message: `You can check your account activity here:\n\n${accountUrl}`
    };
  } catch (error) {
    console.error('❌ Error getting account activity link:', error);
    return {
      success: false,
      message: `❌ Failed to get account activity link: ${error instanceof Error ? error.message : 'Unknown error'}`,
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
      message: `🔑 Your Wallet Address:\n${wallet.address}\n\n💰 Balance:\nALGO: ${balance.algo.toFixed(6)}\nAssets: ${balance.assets.length}`
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

    // Use Lora AlgoKit explorer
    const explorerUrl = `https://lora.algokit.io/testnet/transaction/${txid}`;

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

      // Generate explorer links using Lora AlgoKit explorer
      const explorerLinks = txids.map((txid, i) => {
        return `${i + 1}. ${txid}\n   https://lora.algokit.io/testnet/transaction/${txid}`;
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

/**
 * Execute send_nft transaction
 */
async function executeSendNft(
  intent: ParsedIntent,
  phoneNumber: string
): Promise<TransactionResult> {
  const { asset_id, recipient, amount } = intent.parameters as {
    asset_id?: number | string;
    recipient?: string;
    amount?: number;
  };

  if (!asset_id || !recipient) {
    return {
      success: false,
      message: '❌ Missing required parameters: asset_id and recipient',
      error: 'Missing parameters',
    };
  }

  try {
    const assetId = Number(asset_id);
    if (Number.isNaN(assetId) || assetId <= 0) {
      return { success: false, message: '❌ Invalid asset_id provided.', error: 'Invalid asset_id' };
    }

    const transferAmount = amount ?? 1;
    if (transferAmount <= 0) {
      return { success: false, message: '❌ Amount must be greater than 0.', error: 'Invalid amount' };
    }

    const senderWallet = await walletManager.getOrCreateWallet(phoneNumber);

    let recipientAddress = recipient;
    if (recipient.startsWith('+')) {
      const recipientWallet = await walletManager.getOrCreateWallet(recipient);
      recipientAddress = recipientWallet.address;
      console.log(`📱 Resolved phone ${recipient} to address ${recipientAddress}`);
    }

    if (!algosdk.isValidAddress(recipientAddress)) {
      return {
        success: false,
        message: `❌ Invalid recipient address: ${recipient}`,
        error: 'Invalid address',
      };
    }

    const balance = await algorandClient.getAccountBalance(senderWallet.address);
    const holding = balance.assets.find((asset: any) => asset['asset-id'] === assetId);
    const available = holding ? Number(holding.amount) : 0;

    if (available < transferAmount) {
      return {
        success: false,
        message: `❌ Insufficient NFT balance. Available: ${available}, required: ${transferAmount}`,
        error: 'Insufficient NFT balance',
      };
    }

    const params = await algorandClient.getTransactionParams();
    const txn = algosdk.makeAssetTransferTxnWithSuggestedParamsFromObject({
      sender: senderWallet.address,
      receiver: recipientAddress,
      amount: transferAmount,
      assetIndex: assetId,
      suggestedParams: params,
    });

    const signedTxn = await walletManager.signTransaction(txn, phoneNumber);
    const txid = await algorandClient.sendTransaction(signedTxn);
    await algorandClient.waitForConfirmation(txid, 4);

    const explorerUrl = `https://lora.algokit.io/testnet/transaction/${txid}`;
    const assetUrl = `https://lora.algokit.io/testnet/asset/${assetId}`;

    return {
      success: true,
      txid,
      message:
        `🖼️ Sent ${transferAmount} unit(s) of asset ${assetId} to ${recipient.startsWith('+') ? recipient : recipientAddress.substring(0, 8) + '...'}\n\n` +
        `TxID: ${txid}\nAsset: ${assetUrl}\n\nView transaction:\n${explorerUrl}`,
    };
  } catch (error) {
    console.error('❌ Error executing send_nft:', error);
    return {
      success: false,
      message: `❌ NFT transfer failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Execute send_nft_multi transaction
 */
async function executeSendNftMulti(
  intent: ParsedIntent,
  phoneNumber: string
): Promise<TransactionResult> {
  const { recipients, asset_id } = intent.parameters as {
    recipients?: Array<{ address: string; amount?: number }>;
    asset_id?: number | string;
  };

  if (!asset_id || !Array.isArray(recipients) || recipients.length === 0) {
    return {
      success: false,
      message: '❌ Missing required parameters: asset_id and recipients array',
      error: 'Missing parameters',
    };
  }

  try {
    const assetId = Number(asset_id);
    if (Number.isNaN(assetId) || assetId <= 0) {
      return { success: false, message: '❌ Invalid asset_id provided.', error: 'Invalid asset_id' };
    }

    const senderWallet = await walletManager.getOrCreateWallet(phoneNumber);

    const resolvedRecipients: Array<{ address: string; amount: number; display: string }> = [];
    for (const recipient of recipients) {
      let recipientAddress = recipient.address;
      const amount = recipient.amount ?? 1;
      if (!recipientAddress || amount <= 0) {
        throw new Error('Each recipient must include a valid address and positive amount.');
      }

      if (recipientAddress.startsWith('+')) {
        const recipientWallet = await walletManager.getOrCreateWallet(recipientAddress);
        recipientAddress = recipientWallet.address;
        console.log(`📱 Resolved phone ${recipient.address} to address ${recipientAddress}`);
      }

      if (!algosdk.isValidAddress(recipientAddress)) {
        throw new Error(`Invalid recipient address: ${recipient.address}`);
      }

      resolvedRecipients.push({
        address: recipientAddress,
        amount,
        display: recipient.address.startsWith('+')
          ? recipient.address
          : `${recipientAddress.substring(0, 8)}...`,
      });
    }

    const totalAmount = resolvedRecipients.reduce((sum, r) => sum + r.amount, 0);

    const balance = await algorandClient.getAccountBalance(senderWallet.address);
    const holding = balance.assets.find((asset: any) => asset['asset-id'] === assetId);
    const available = holding ? Number(holding.amount) : 0;

    if (available < totalAmount) {
      return {
        success: false,
        message: `❌ Insufficient NFT balance. Available: ${available}, required: ${totalAmount}`,
        error: 'Insufficient NFT balance',
      };
    }

    const params = await algorandClient.getTransactionParams();
    const txids: string[] = [];

    for (const recipient of resolvedRecipients) {
      const txn = algosdk.makeAssetTransferTxnWithSuggestedParamsFromObject({
        sender: senderWallet.address,
        receiver: recipient.address,
        amount: recipient.amount,
        assetIndex: assetId,
        suggestedParams: params,
      });

      const signedTxn = await walletManager.signTransaction(txn, phoneNumber);
      const txid = await algorandClient.sendTransaction(signedTxn);
      txids.push(txid);
      await algorandClient.waitForConfirmation(txid, 4);
    }

    const explorerLinks = txids
      .map(
        (txid, idx) =>
          `${idx + 1}. ${txid}\n   https://lora.algokit.io/testnet/transaction/${txid}`
      )
      .join('\n\n');

    const assetUrl = `https://lora.algokit.io/testnet/asset/${assetId}`;

    return {
      success: true,
      txid: txids[0],
      message:
        `🖼️ Sent ${totalAmount} unit(s) of asset ${assetId} to ${resolvedRecipients.length} recipients\n\n` +
        `Asset: ${assetUrl}\n\nTxIDs:\n${explorerLinks}`,
    };
  } catch (error) {
    console.error('❌ Error executing send_nft_multi:', error);
    return {
      success: false,
      message: `❌ NFT multi-send failed: ${
        error instanceof Error ? error.message : 'Unknown error'
      }`,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Execute opt_out transaction
 */
async function executeOptOut(
  intent: ParsedIntent,
  phoneNumber: string
): Promise<TransactionResult> {
  const { asset_id, close_to } = intent.parameters as {
    asset_id?: number | string;
    close_to?: string;
  };

  if (!asset_id || !close_to) {
    return {
      success: false,
      message: '❌ Missing required parameters: asset_id and close_to',
      error: 'Missing parameters',
    };
  }

  try {
    const assetId = Number(asset_id);
    if (Number.isNaN(assetId) || assetId <= 0) {
      return { success: false, message: '❌ Invalid asset_id provided.', error: 'Invalid asset_id' };
    }

    let closeAddress = close_to;
    if (close_to.startsWith('+')) {
      const targetWallet = await walletManager.getOrCreateWallet(close_to);
      closeAddress = targetWallet.address;
      console.log(`📱 Resolved phone ${close_to} to address ${closeAddress}`);
    }

    if (!algosdk.isValidAddress(closeAddress)) {
      return {
        success: false,
        message: `❌ Invalid close_to address: ${close_to}`,
        error: 'Invalid address',
      };
    }

    const wallet = await walletManager.getOrCreateWallet(phoneNumber);
    const params = await algorandClient.getTransactionParams();

    const txn = algosdk.makeAssetTransferTxnWithSuggestedParamsFromObject({
      sender: wallet.address,
      receiver: closeAddress,
      amount: 0,
      assetIndex: assetId,
      closeRemainderTo: closeAddress,
      suggestedParams: params,
    });

    const signedTxn = await walletManager.signTransaction(txn, phoneNumber);
    const txid = await algorandClient.sendTransaction(signedTxn);
    await algorandClient.waitForConfirmation(txid, 4);

    const explorerUrl = `https://lora.algokit.io/testnet/transaction/${txid}`;

    return {
      success: true,
      txid,
      message:
        `✅ Opted out of asset ${assetId}.\nRemaining units were closed to ${close_to.startsWith('+') ? close_to : closeAddress.substring(0, 8) + '...'}.\n\n` +
        `TxID: ${txid}\nView transaction:\n${explorerUrl}`,
    };
  } catch (error) {
    console.error('❌ Error executing opt_out:', error);
    return {
      success: false,
      message: `❌ Opt-out failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Execute create_nft transaction
 */
async function executeCreateNft(
  intent: ParsedIntent,
  phoneNumber: string
): Promise<TransactionResult> {
  const {
    name,
    description,
    supply,
    image_url,
    url,
    media_id,
  } = intent.parameters as {
    name?: string;
    description?: string;
    supply?: number;
    image_url?: string;
    url?: string;
    media_id?: string;
  };

  const nftName = name?.trim();
  if (!nftName) {
    return {
      success: false,
      message: '❌ Missing NFT name. Please specify a name for the NFT.',
      error: 'Missing name',
    };
  }

  const totalSupply = supply && supply > 0 ? Math.floor(supply) : 1;

  try {
    const wallet = await walletManager.getOrCreateWallet(phoneNumber);
    const params = await algorandClient.getTransactionParams();

    const unitName = nftName.replace(/[^0-9A-Za-z]/g, '').toUpperCase().slice(0, 8) || 'NFT';

    const metadata: Record<string, any> = {
      name: nftName,
      description: description || '',
      created_by: phoneNumber,
      created_at: new Date().toISOString(),
    };

    let assetUrlValue = image_url || url || '';
    let metadataHash: Buffer | undefined;

    if (media_id) {
      try {
        const downloaded = await downloadMedia(media_id);
        metadataHash = downloaded.sha256;
        metadata['image_mime_type'] = downloaded.mimeType;
        metadata['image_sha256'] = downloaded.sha256.toString('base64');

        if (!assetUrlValue) {
          const uploadResult = await uploadMediaToIpfs(downloaded);

          if (uploadResult) {
            assetUrlValue = `ipfs://${uploadResult.cid}`;
            metadata['image_url'] = assetUrlValue;
            metadata['image_gateway'] = uploadResult.gatewayUrl;
          } else {
            assetUrlValue = `media://${media_id}`;
          }
        }
      } catch (downloadError) {
        console.warn('⚠️ Failed to download media for NFT:', downloadError);
      }
    }

    if (assetUrlValue) {
      metadata['image_url'] = assetUrlValue;
    }

    const noteBuffer = Buffer.from(JSON.stringify(metadata));
    const note = noteBuffer.length > 1024 ? noteBuffer.subarray(0, 1024) : noteBuffer;

    const txn = algosdk.makeAssetCreateTxnWithSuggestedParamsFromObject({
      sender: wallet.address,
      total: totalSupply,
      decimals: 0,
      defaultFrozen: false,
      unitName,
      assetName: nftName,
      manager: wallet.address,
      reserve: undefined,
      freeze: undefined,
      clawback: undefined,
      assetURL: assetUrlValue,
      assetMetadataHash: metadataHash,
      note,
      suggestedParams: params,
    });

    const signedTxn = await walletManager.signTransaction(txn, phoneNumber);
    const txid = await algorandClient.sendTransaction(signedTxn);
    const confirmation = await algorandClient.waitForConfirmation(txid, 4);

    const assetId = confirmation['asset-index'] || confirmation.assetIndex;
    const explorerUrl = `https://lora.algokit.io/testnet/transaction/${txid}`;
    const assetExplorerUrl = assetId
      ? `https://lora.algokit.io/testnet/asset/${assetId}`
      : null;

    let message = `🎨 Created NFT "${nftName}" with total supply ${totalSupply}.\n\n`;
    
    if (assetId && assetExplorerUrl) {
      message += `*NFT Link:*\n${assetExplorerUrl}\n\n`;
    }
    
    if (assetId) {
      message += `*Asset ID:* ${assetId}\n`;
    }
    
    message += `*Transaction ID:* ${txid}\n*View transaction:*\n${explorerUrl}`;

    return {
      success: true,
      txid,
      message,
    };
  } catch (error) {
    console.error('❌ Error creating NFT:', error);
    return {
      success: false,
      message: `❌ NFT creation failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}


