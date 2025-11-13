/**
 * Message Processor
 *
 * Handles incoming WhatsApp messages synchronously:
 * 1. Detect greetings and send onboarding response
 * 2. Parse intents via AlgoIntent engine (Perplexity)
 * 3. Execute Algorand transactions based on parsed intent
 * 4. Send WhatsApp replies with status / errors
 */

import { ExtractedMessage } from './types/whatsapp';
import { ParsedIntent } from './intent/types';
import { intentEngine } from './intent/engine';
import { executeTransaction, TransactionResult } from './transaction/executor';
import { sendWhatsAppMessage, sendWhatsAppQuickReplies } from './whatsapp/sender';

const activeProcesses = new Set<Promise<void>>();
let shuttingDown = false;
const transactionalIntents = new Set([
  'send_algo',
  'send_algo_multi',
  'send_nft',
  'send_nft_multi',
  'balance',
  'wallet_address',
  'account_activity',
  'opt_in',
  'opt_out',
  'create_nft',
  'create_nft_with_image',
]);
const confirmationIntents = new Set(['send_algo', 'send_algo_multi', 'send_nft', 'send_nft_multi']);
const citationRegex = /\[\d+(?:\]\[\d+)*\]/g;

const TX_CONFIRM_BUTTON_ID = 'tx_confirm';
const TX_CANCEL_BUTTON_ID = 'tx_cancel';
const NFT_ASA_BUTTON_ID = 'nft_asa';
const NFT_IMAGE_BUTTON_ID = 'nft_image';
const confirmKeywords = ['yes', 'y', 'confirm', 'sure', 'ok', 'send'];
const cancelKeywords = ['no', 'n', 'cancel', 'stop', 'abort'];

const informationalIntents = new Set([
  'explain_algorand',
  'explain_defi',
  'explain_nft',
  'explain_trading',
  'general_help',
  'understand_algorand_questions',
  'market_info',
  'check_prices',
]);

interface PendingTransaction {
  intent: ParsedIntent;
  createdAt: number;
}

interface PendingNftCreation {
  type: 'asa' | 'image';
  name?: string;
  mediaId?: string;
  mediaType?: string;
  createdAt: number;
}

const PENDING_TX_TTL_MS = 2 * 60 * 1000; // 2 minutes
const PENDING_NFT_TTL_MS = 5 * 60 * 1000; // 5 minutes
const pendingTransactions = new Map<string, PendingTransaction>();
const pendingNftCreations = new Map<string, PendingNftCreation>();
const quickReplyActions: Record<
  string,
  | { type: 'direct'; message: string }
  | { type: 'prompt'; response: string }
> = {
  capability_balance: { type: 'direct', message: 'Check my balance' },
  capability_send_algo: {
    type: 'prompt',
    response:
      'Sure! Tell me how much ALGO to send and the recipient (phone number or Algorand address). Example:\n"Send 2 ALGO to +1234567890"',
  },
  capability_opt_in: {
    type: 'prompt',
    response: 'Got it! Please tell me the asset ID you want to opt into. Example:\n"Opt in to asset 12345"',
  },
  capability_create_nft: { type: 'direct', message: 'Create an NFT' },
};

const capabilityPatterns = [
  /what\s+algointent\s+can\s+do/,
  /what\s+can\s+algointent\s+do/,
  /what\s+can\s+you\s+do/,
  /how\s+can\s+you\s+help/,
  /what\s+are\s+your\s+capabilities/,
  /what\s+do\s+you\s+do/,
];

const unsupportedIntentMessages: Record<string, string> = {
  trade_algo:
    '📈 Trading commands are not available here yet. Use the AlgoIntent trading dashboard to place orders.',
  swap_tokens:
    '🔄 Swapping tokens requires the trading dashboard for now. Please open AlgoIntent on the web to swap assets.',
  set_limit_order:
    '📊 Limit orders aren’t supported in WhatsApp yet. Use the AlgoIntent trading interface to set advanced orders.',
  set_stop_loss:
    '🛡️ Stop-loss orders require the trading dashboard. Please manage protective orders from the web app.',
};

const unsupportedTransactionalIntents = new Set(Object.keys(unsupportedIntentMessages));

const mediaTypesNotSupported = new Set([
  'video',
  'audio',
  'document',
  'location',
  'contacts',
  'sticker',
]);

function getPendingTransaction(phoneNumber: string): PendingTransaction | null {
  const pending = pendingTransactions.get(phoneNumber);
  if (!pending) {
    return null;
  }

  if (Date.now() - pending.createdAt > PENDING_TX_TTL_MS) {
    pendingTransactions.delete(phoneNumber);
    return null;
  }

  return pending;
}

function setPendingTransaction(phoneNumber: string, intent: ParsedIntent): void {
  pendingTransactions.set(phoneNumber, {
    intent,
    createdAt: Date.now(),
  });
}

function clearPendingTransaction(phoneNumber: string): void {
  pendingTransactions.delete(phoneNumber);
}

function getPendingNftCreation(phoneNumber: string): PendingNftCreation | null {
  const pending = pendingNftCreations.get(phoneNumber);
  if (!pending) {
    return null;
  }

  if (Date.now() - pending.createdAt > PENDING_NFT_TTL_MS) {
    pendingNftCreations.delete(phoneNumber);
    return null;
  }

  return pending;
}

function setPendingNftCreation(phoneNumber: string, type: 'asa' | 'image'): void {
  pendingNftCreations.set(phoneNumber, {
    type,
    createdAt: Date.now(),
  });
}

function clearPendingNftCreation(phoneNumber: string): void {
  pendingNftCreations.delete(phoneNumber);
}

function matchesKeyword(input: string, keywords: string[]): boolean {
  if (!input) {
    return false;
  }

  const sanitized = input.replace(/[^a-z]/g, ' ').replace(/\s+/g, ' ').trim();
  if (!sanitized) {
    return false;
  }

  return keywords.some(
    (keyword) =>
      sanitized === keyword ||
      sanitized.startsWith(`${keyword} `)
  );
}

function formatRecipient(recipient: string): string {
  if (!recipient) {
    return 'Unknown recipient';
  }

  if (recipient.startsWith('+')) {
    return recipient;
  }

  if (recipient.length <= 12) {
    return recipient;
  }

  return `${recipient.slice(0, 6)}...${recipient.slice(-6)}`;
}

function buildTransactionSummary(intent: ParsedIntent): string | null {
  if (intent.intent === 'send_algo') {
    const amount = intent.parameters.amount;
    const recipient = intent.parameters.recipient;

    if (amount == null || !recipient) {
      return null;
    }

    const feeEstimate = 0.001; // Default Algorand min fee
    const recipientDisplay = formatRecipient(recipient);

    return (
      '*Algo Intent*\n' +
      `Sending ${amount} ALGO to ${recipientDisplay}\n\n` +
      `*Amount:* ${amount} ALGO\n` +
      `*To:* ${recipientDisplay}\n` +
      `*Fee:* ${feeEstimate.toFixed(3)} ALGO\n\n` +
      'Reply YES to sign and send, or NO to cancel.'
    );
  }

  if (intent.intent === 'send_algo_multi') {
    const recipients = intent.parameters.recipients;

    if (!Array.isArray(recipients) || recipients.length === 0) {
      return null;
    }

    let totalAmount = 0;
    const lines = recipients.map((recipient: any, index: number) => {
      const amount = Number(recipient?.amount) || 0;
      const address = typeof recipient?.address === 'string' ? recipient.address : '';
      totalAmount += amount;
      return `${index + 1}. ${formatRecipient(address)} — ${amount} ALGO`;
    });

    const feeEstimate = 0.001 * recipients.length;

    return (
      '*Algo Intent*\n' +
      `Sending ${totalAmount} ALGO to ${recipients.length} recipients\n\n` +
      lines.join('\n') +
      '\n\n' +
      `*Total:* ${totalAmount} ALGO\n` +
      `*Estimated Fee:* ${feeEstimate.toFixed(3)} ALGO\n\n` +
      'Reply YES to approve the batch, or NO to cancel.'
    );
  }

  if (intent.intent === 'send_nft') {
    const assetId = intent.parameters.asset_id;
    const amount = intent.parameters.amount ?? 1;
    const recipient = intent.parameters.recipient;

    if (!assetId || !recipient) {
      return null;
    }

    const recipientDisplay = formatRecipient(String(recipient));

    return (
      '*Algo Intent*\n' +
      `Sending ${amount} unit(s) of NFT ${assetId} to ${recipientDisplay}\n\n` +
      `*Asset ID:* ${assetId}\n` +
      `*Amount:* ${amount}\n` +
      `*To:* ${recipientDisplay}\n\n` +
      'Reply YES to send the NFT, or NO to cancel.'
    );
  }

  if (intent.intent === 'send_nft_multi') {
    const assetId = intent.parameters.asset_id;
    const recipients = intent.parameters.recipients;

    if (!assetId || !Array.isArray(recipients) || recipients.length === 0) {
      return null;
    }

    let totalAmount = 0;
    const lines = recipients.map((recipient: any, index: number) => {
      const amount = Number(recipient?.amount ?? 0);
      const address = typeof recipient?.address === 'string' ? recipient.address : '';
      totalAmount += amount;
      return `${index + 1}. ${formatRecipient(address)} — ${amount} unit(s)`;
    });

    const feeEstimate = 0.001 * recipients.length;

    return (
      '*Algo Intent*\n' +
      `Sending ${totalAmount} unit(s) of NFT ${assetId} to ${recipients.length} recipients\n\n` +
      lines.join('\n') +
      '\n\n' +
      `*Asset ID:* ${assetId}\n` +
      `*Total Units:* ${totalAmount}\n` +
      `*Estimated Fee:* ${feeEstimate.toFixed(3)} ALGO\n\n` +
      'Reply YES to approve the batch, or NO to cancel.'
    );
  }

  return null;
}

/**
 * Process an extracted WhatsApp message.
 * Tracks the lifecycle so shutdown hooks can wait for completion.
 *
 * @param message - Extracted WhatsApp message payload
 */
export function processIncomingMessage(message: ExtractedMessage): Promise<void> {
  if (shuttingDown) {
    console.warn('⚠️ System is shutting down, processing message with limited time.');
  }

  const processingPromise = handleMessage(message);
  activeProcesses.add(processingPromise);

  processingPromise.finally(() => {
    activeProcesses.delete(processingPromise);
  });

  return processingPromise;
}

/**
 * Mark the processor as shutting down to stop accepting new long-running work.
 */
export function markMessageProcessorShuttingDown(): void {
  shuttingDown = true;
}

/**
 * Wait for in-flight message processing to finish, up to timeoutMs.
 *
 * @param timeoutMs - Maximum time to wait (default 10s)
 */
export async function waitForMessageProcessingToComplete(timeoutMs: number = 10_000): Promise<void> {
  const start = Date.now();

  while (activeProcesses.size > 0) {
    console.log(`⏳ Waiting for ${activeProcesses.size} in-flight message(s) to finish...`);

    const processes = Array.from(activeProcesses);

    await Promise.race([
      Promise.allSettled(processes),
      new Promise((resolve) => setTimeout(resolve, 250)),
    ]);

    if (Date.now() - start >= timeoutMs) {
      console.warn(`⚠️ Timeout reached. ${activeProcesses.size} message(s) still in progress.`);
      return;
    }
  }

  console.log('✅ All in-flight messages completed.');
}

/**
 * Get current number of in-flight message handlers.
 */
export function getActiveMessageCount(): number {
  return activeProcesses.size;
}

/**
 * Core handler logic for an extracted WhatsApp message.
 */
async function handleMessage(message: ExtractedMessage): Promise<void> {
  const { phoneNumber, messageType, messageId, buttonId } = message;
  let messageText = message.messageText;

  const phoneDisplay =
    phoneNumber.length > 4
      ? `${phoneNumber.slice(0, -4)}${'*'.repeat(4)}`
      : phoneNumber;

  console.log(`\n🔄 Processing message ${messageId} from ${phoneDisplay}`);

  const isTxConfirmButton =
    messageType === 'interactive' && buttonId === TX_CONFIRM_BUTTON_ID;
  const isTxCancelButton =
    messageType === 'interactive' && buttonId === TX_CANCEL_BUTTON_ID;
  const isNftAsaButton =
    messageType === 'interactive' && buttonId === NFT_ASA_BUTTON_ID;
  const isNftImageButton =
    messageType === 'interactive' && buttonId === NFT_IMAGE_BUTTON_ID;

  // Check if we're waiting for NFT image - allow images in that case
  // This MUST be checked BEFORE the !messageText check to allow images for NFT creation
  const pendingNftCheck = getPendingNftCreation(phoneNumber);
  const isWaitingForNftImage = pendingNftCheck && pendingNftCheck.type === 'image';

  // Allow images if we're waiting for NFT image, otherwise check for text
  if (!messageText && messageType !== 'interactive' && !(messageType === 'image' && isWaitingForNftImage)) {
    console.log(`⚠️ Unsupported message type (${messageType}). Responding with guidance.`);
    await sendWhatsAppMessage(
      phoneNumber,
      '❌ Sorry, I can only process text messages at the moment. Please send your request as text, for example: "Send 2 ALGO to +1234567890" or "Check my balance".'
    );
    return;
  }

  if (mediaTypesNotSupported.has(messageType) && !isWaitingForNftImage) {
    console.log(`⚠️ Media message (${messageType}) detected. Informing user to send text.`);
    await sendWhatsAppMessage(
      phoneNumber,
      '📎 I cannot process media yet. Please send your instruction in text, for example: "Create an NFT named Sunrise" or "Send 1 ALGO to +123..." If you need to share artwork, provide a link to the image instead of attaching it.'
    );
    return;
  }

  // Allow images if we're waiting for NFT image
  if (messageType === 'image' && isWaitingForNftImage) {
    // This will be handled in the NFT creation flow below
  } else if (mediaTypesNotSupported.has(messageType)) {
    console.log(`⚠️ Media message (${messageType}) detected. Informing user to send text.`);
    await sendWhatsAppMessage(
      phoneNumber,
      '📎 I can only process images for NFT creation. Please send an image or use text commands.'
    );
    return;
  }

  // Handle NFT creation type selection
  if (isNftAsaButton || isNftImageButton) {
    const nftType = isNftAsaButton ? 'asa' : 'image';
    setPendingNftCreation(phoneNumber, nftType);
    console.log(`🎨 User selected NFT creation type: ${nftType}`);
    await sendWhatsAppMessage(
      phoneNumber,
      `Great! You selected ${nftType === 'asa' ? 'ASA NFT' : 'Image NFT'}.\n\nPlease enter the name for your NFT:`
    );
    return;
  }

  // Handle NFT name input or image upload
  const pendingNft = getPendingNftCreation(phoneNumber);
  if (pendingNft) {
    // If user sent an image and we're waiting for image type
    if (pendingNft.type === 'image' && message.mediaId && message.mediaType?.startsWith('image')) {
      if (pendingNft.name) {
        // We have both name and image, proceed with creation
        const nftName = pendingNft.name;
        console.log(`🎨 Creating NFT "${nftName}" with image (type: ${pendingNft.type})`);
        clearPendingNftCreation(phoneNumber);

        const nftIntent: ParsedIntent = {
          intent: 'create_nft_with_image',
          parameters: {
            name: nftName,
            media_id: message.mediaId,
            media_type: message.mediaType,
          },
        };

        await sendWhatsAppMessage(phoneNumber, `🚀 Creating your NFT "${nftName}" with image...`);
        const txResult = await executeTransaction(nftIntent, phoneNumber);
        await sendTransactionReply(phoneNumber, phoneDisplay, txResult, nftIntent);
        return;
      } else {
        // Image sent but no name yet, store image info and ask for name
        const updatedPending = pendingNftCreations.get(phoneNumber);
        if (updatedPending) {
          updatedPending.mediaId = message.mediaId;
          updatedPending.mediaType = message.mediaType;
        }
        await sendWhatsAppMessage(
          phoneNumber,
          '✅ Image received! Now please enter the name for your NFT:'
        );
        return;
      }
    }

    // If user sent text (name)
    if (messageText) {
      const nftName = messageText.trim();
      if (!nftName || nftName.length < 1) {
        await sendWhatsAppMessage(
          phoneNumber,
          '❌ Please provide a valid NFT name (at least 1 character).'
        );
        return;
      }

      // Update pending NFT with name
      const updatedPending = pendingNftCreations.get(phoneNumber);
      if (updatedPending) {
        updatedPending.name = nftName;
      }

      if (pendingNft.type === 'asa') {
        // ASA type - proceed immediately
        console.log(`🎨 Creating ASA NFT "${nftName}"`);
        clearPendingNftCreation(phoneNumber);

        const nftIntent: ParsedIntent = {
          intent: 'create_nft',
          parameters: {
            name: nftName,
          },
        };

        await sendWhatsAppMessage(phoneNumber, `🚀 Creating your NFT "${nftName}"...`);
        const txResult = await executeTransaction(nftIntent, phoneNumber);
        await sendTransactionReply(phoneNumber, phoneDisplay, txResult, nftIntent);
        return;
      } else {
        // Image type - check if image was sent with name or stored earlier
        const imageId = message.mediaId || pendingNft.mediaId;
        const imageType = message.mediaType || pendingNft.mediaType;

        if (imageId && imageType?.startsWith('image')) {
          // Image available (sent with name or stored earlier), proceed
          console.log(`🎨 Creating NFT "${nftName}" with image`);
          clearPendingNftCreation(phoneNumber);

          const nftIntent: ParsedIntent = {
            intent: 'create_nft_with_image',
            parameters: {
              name: nftName,
              media_id: imageId,
              media_type: imageType,
            },
          };

          await sendWhatsAppMessage(phoneNumber, `🚀 Creating your NFT "${nftName}" with image...`);
          const txResult = await executeTransaction(nftIntent, phoneNumber);
          await sendTransactionReply(phoneNumber, phoneDisplay, txResult, nftIntent);
          return;
        } else {
          // No image yet, ask for it
          await sendWhatsAppMessage(
            phoneNumber,
            `✅ Name "${nftName}" saved! Now please send the image for your NFT:`
          );
          return;
        }
      }
    }
  }

  if (
    messageType === 'interactive' &&
    buttonId &&
    !isTxConfirmButton &&
    !isTxCancelButton &&
    !isNftAsaButton &&
    !isNftImageButton &&
    quickReplyActions[buttonId]
  ) {
    const action = quickReplyActions[buttonId];
    if (action.type === 'direct') {
      messageText = action.message;
      console.log(`🔁 Quick reply "${buttonId}" mapped to message: ${messageText}`);
    } else if (action.type === 'prompt') {
      console.log(`🔁 Quick reply "${buttonId}" prompting user for more info.`);
      await sendWhatsAppMessage(phoneNumber, action.response);
      return;
    }
  }

  if (!messageText) {
    console.log(`⚠️ No text content to process.`);
    await sendWhatsAppMessage(
      phoneNumber,
      '❌ Sorry, I could not understand your request. Please try rephrasing it. For example: "Send 2 ALGO to +1234567890" or "Check my balance".'
    );
    return;
  }

  const normalizedText = messageText ? messageText.toLowerCase().trim() : '';

  const pendingTx = getPendingTransaction(phoneNumber);
  if (pendingTx) {
    const isConfirmResponse =
      isTxConfirmButton || matchesKeyword(normalizedText, confirmKeywords);
    const isCancelResponse =
      isTxCancelButton || matchesKeyword(normalizedText, cancelKeywords);

    if (isConfirmResponse) {
      console.log('✅ User confirmed pending transaction.');
      clearPendingTransaction(phoneNumber);

      await sendWhatsAppMessage(
        phoneNumber,
        '✍️ Signing and sending your transaction...'
      );

      const txResult = await executeTransaction(pendingTx.intent, phoneNumber);
      await sendTransactionReply(phoneNumber, phoneDisplay, txResult, pendingTx.intent);
      return;
    }

  const greetingPatterns = ['hello', 'hi', 'hey', 'greetings', 'hallo', 'hola', 'bonjour'];

    if (isCancelResponse) {
      console.log('🚫 User cancelled pending transaction.');
      clearPendingTransaction(phoneNumber);
      await sendWhatsAppMessage(
        phoneNumber,
        '✅ Transaction cancelled. Let me know if you need anything else.'
      );
      return;
    }

    await sendWhatsAppMessage(
      phoneNumber,
      '⚠️ You have a pending transaction. Reply YES to confirm or NO to cancel.'
    );
    return;
  }

  const greetingPatterns = ['hello', 'hi', 'hey', 'greetings', 'hallo', 'hola', 'bonjour'];

  if (greetingPatterns.some((pattern) => normalizedText.includes(pattern))) {
    const greetingMessage =
      '👋 Welcome to AlgoIntent!\n\n' +
      'I am your Algorand assistant. I can help you:\n' +
      '• Send ALGO to addresses or phone numbers\n' +
      '• Check your balance\n' +
      '• Opt-in to assets\n' +
      '• Create and send NFTs\n' +
      '• Answer questions about Algorand\n\n' +
      'Just tell me what you would like to do in plain English!';

    console.log('👋 Greeting detected. Responding with onboarding quick replies.');
    await sendWhatsAppQuickReplies(phoneNumber, greetingMessage, [
      { id: 'capability_balance', title: 'Check balance' },
      { id: 'capability_send_algo', title: 'Send ALGO' },
      { id: 'capability_create_nft', title: 'Create NFT' },
    ]);

    await sendWhatsAppMessage(
      phoneNumber,
      'Example: "Send 2 ALGO to +1234567890" or "Opt in to asset 12345"'
    );
    return;
  }

  const sanitizedText = normalizedText.replace(/[?.!]/g, ' ');
  
  // Pattern matching for wallet address queries
  const walletAddressPatterns = [
    /wallet\s+address/,
    /my\s+wallet\s+address/,
    /what.*wallet\s+address/,
    /show.*wallet\s+address/,
    /wallet\s+adress/, // Common typo
    /my\s+address/,
    /what.*my\s+address/,
  ];
  
  // Pattern matching for account activity queries
  const accountActivityPatterns = [
    /account\s+activity/,
    /my\s+account\s+activity/,
    /how.*check.*account\s+activity/,
    /what.*account\s+activity/,
    /check.*account\s+activity/,
    /view.*account\s+activity/,
    /show.*account\s+activity/,
  ];
  
  if (accountActivityPatterns.some((pattern) => pattern.test(sanitizedText))) {
    console.log('📊 Account activity query detected. Getting account link.');
    const accountActivityIntent: ParsedIntent = {
      intent: 'account_activity',
      parameters: {},
    };
    const txResult = await executeTransaction(accountActivityIntent, phoneNumber);
    await sendTransactionReply(phoneNumber, phoneDisplay, txResult, accountActivityIntent);
    return;
  }
  
  if (walletAddressPatterns.some((pattern) => pattern.test(sanitizedText))) {
    console.log('🔑 Wallet address query detected. Getting wallet address.');
    const walletAddressIntent: ParsedIntent = {
      intent: 'wallet_address',
      parameters: {},
    };
    const txResult = await executeTransaction(walletAddressIntent, phoneNumber);
    await sendTransactionReply(phoneNumber, phoneDisplay, txResult, walletAddressIntent);
    return;
  }
  
  if (capabilityPatterns.some((pattern) => pattern.test(sanitizedText))) {
    const capabilityButtons = [
      { id: 'capability_balance', title: 'Check balance' },
      { id: 'capability_send_algo', title: 'Send ALGO' },
      { id: 'capability_create_nft', title: 'Create NFT' },
    ];

    const capabilityBody =
      'Here is what I can help you with right now. Tap a button or tell me directly:';

    console.log('📋 Capability question detected, sending quick reply buttons.');
    await sendWhatsAppQuickReplies(phoneNumber, capabilityBody, capabilityButtons);
    return;
  }

  console.log('🧠 Parsing intent via AlgoIntent engine...');

  const parsedIntent = await intentEngine.parseIntent(messageText);

  if (!parsedIntent) {
    console.warn('⚠️ Failed to parse intent. Responding with clarification message.');
    await sendWhatsAppMessage(
      phoneNumber,
      '❌ Sorry, I could not understand your request. Please try rephrasing it. For example: "Send 2 ALGO to +1234567890" or "Check my balance".'
    );
    return;
  }

  const normalizedIntent = (parsedIntent.intent || '').trim().toLowerCase();

  console.log(`✅ Parsed intent: ${normalizedIntent}`);
  if (parsedIntent.parameters) {
    console.log(`📋 Parameters: ${JSON.stringify(parsedIntent.parameters, null, 2)}`);
  }
  if (parsedIntent.context) {
    console.log(`📝 Context: ${parsedIntent.context}`);
  }
  if (parsedIntent.explanation) {
    console.log(`💡 Explanation: ${parsedIntent.explanation}`);
  }

  // Handle NFT creation requests - show type selection buttons
  if (normalizedIntent === 'create_nft' || normalizedIntent === 'create_nft_with_image') {
    const pendingNft = getPendingNftCreation(phoneNumber);
    if (pendingNft) {
      // User already selected type, waiting for name (handled above)
      return;
    }

    console.log('🎨 NFT creation request detected. Showing type selection.');
    await sendWhatsAppQuickReplies(
      phoneNumber,
      '🎨 Great! Let\'s create an NFT. Choose the type:',
      [
        { id: NFT_ASA_BUTTON_ID, title: 'ASA NFT' },
        { id: NFT_IMAGE_BUTTON_ID, title: 'Image NFT' },
      ]
    );
    await sendWhatsAppMessage(
      phoneNumber,
      'After selecting, I\'ll ask you for the NFT name.'
    );
    return;
  }

  if (unsupportedTransactionalIntents.has(normalizedIntent)) {
    const unsupportedMessage =
      unsupportedIntentMessages[normalizedIntent] ||
      '❌ This feature is not available in WhatsApp yet.';
    console.log(`ℹ️ Intent "${normalizedIntent}" is not supported in WhatsApp.`);
    await sendWhatsAppMessage(phoneNumber, unsupportedMessage);
    return;
  }

  if (!transactionalIntents.has(normalizedIntent)) {
    let infoMessage = parsedIntent.explanation || parsedIntent.context || '';

    if (!infoMessage) {
      if (informationalIntents.has(normalizedIntent)) {
        infoMessage = 'ℹ️ Here to help with Algorand knowledge. Ask about wallets, assets, NFTs, trading, or recent updates.';
      } else {
        infoMessage = 'ℹ️ I can help with Algorand transactions, balances, and asset operations.';
      }
    }

    infoMessage = infoMessage.replace(citationRegex, '').replace(/\s{2,}/g, ' ').trim();

    console.log('💬 Informational intent detected, sending explanation response.');
    await sendWhatsAppMessage(phoneNumber, infoMessage);
    return;
  }

  const normalizedIntentData: ParsedIntent = {
    ...parsedIntent,
    intent: normalizedIntent,
  };

  if (confirmationIntents.has(normalizedIntent)) {
    const summaryMessage = buildTransactionSummary(normalizedIntentData);

    if (summaryMessage) {
      console.log('📝 Awaiting user confirmation for transaction.');
      setPendingTransaction(phoneNumber, normalizedIntentData);

      await sendWhatsAppMessage(phoneNumber, summaryMessage);
      await sendWhatsAppQuickReplies(phoneNumber, 'Do you want to send this transaction?', [
        { id: TX_CONFIRM_BUTTON_ID, title: 'Yes, send it' },
        { id: TX_CANCEL_BUTTON_ID, title: 'Cancel' },
      ]);
      return;
    }
  }

  console.log('🚀 Executing transaction / action...');
  const txResult = await executeTransaction(normalizedIntentData, phoneNumber);
  await sendTransactionReply(phoneNumber, phoneDisplay, txResult, normalizedIntentData);
}

async function sendTransactionReply(
  phoneNumber: string,
  phoneDisplay: string,
  txResult: TransactionResult,
  intent: ParsedIntent
): Promise<void> {
  let replyMessage = '';

  if (txResult.success) {
    replyMessage = txResult.message || '✅ Transaction completed successfully.';
  } else if (txResult.message) {
    replyMessage = txResult.message;
  } else if (txResult.error) {
    replyMessage = `❌ Transaction failed: ${txResult.error}`;
  } else if (intent.explanation) {
    replyMessage = intent.explanation;
  } else {
    replyMessage = '❌ Transaction failed: Unknown error.';
  }

  console.log(`📨 Replying to ${phoneDisplay}: ${replyMessage.substring(0, 120)}...`);

  const sendResult = await sendWhatsAppMessage(phoneNumber, replyMessage);

  if (!sendResult.success) {
    console.error(`❌ Failed to send WhatsApp reply: ${sendResult.error}`);
  } else {
    console.log('✅ WhatsApp reply sent successfully.');
  }

  if (txResult.txid) {
    console.log(`🔗 Transaction ID: ${txResult.txid}`);
  }
}
