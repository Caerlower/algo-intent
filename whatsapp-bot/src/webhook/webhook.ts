/**
 * WhatsApp webhook routes for Meta Cloud API
 * Handles webhook verification and incoming message processing
 */

import { Request, Response, Router } from 'express';
import { extractMessage, isValidWebhookPayload } from './extractMessage';
import { WebhookVerificationQuery } from '../types/whatsapp';
import { processIncomingMessage } from '../messageProcessor';

const router = Router();

/**
 * GET /webhook
 * Webhook verification endpoint for Meta
 * 
 * Meta sends a GET request with:
 * - hub.mode: "subscribe"
 * - hub.verify_token: The token you configured
 * - hub.challenge: A random string to echo back
 * 
 * Returns the challenge if verification token matches, otherwise 403
 */
router.get('/webhook', (req: Request, res: Response) => {
  console.log('🔍 Webhook GET (verification) received at', new Date().toISOString());
  console.log('📋 Query params:', JSON.stringify(req.query, null, 2));
  
  const query = req.query as unknown as WebhookVerificationQuery;
  
  const mode = query['hub.mode'];
  const token = query['hub.verify_token'];
  const challenge = query['hub.challenge'];

  // Verify that this is a subscription request
  if (mode === 'subscribe' && token === process.env.WHATSAPP_VERIFY_TOKEN) {
    console.log('✅ Webhook verified successfully');
    console.log('📤 Sending challenge:', challenge);
    res.status(200).send(challenge);
  } else {
    console.error('❌ Webhook verification failed:', {
      mode,
      receivedToken: token,
      expectedToken: process.env.WHATSAPP_VERIFY_TOKEN,
      tokenMatch: token === process.env.WHATSAPP_VERIFY_TOKEN,
      challengeProvided: !!challenge,
    });
    res.sendStatus(403);
  }
});

/**
 * POST /webhook
 * Receives incoming WhatsApp messages from Meta
 *
 * Processes messages by:
 * 1. Extracting message data safely
 * 2. Returning 200 OK immediately to Meta to stop retries
 * 3. Handling the message asynchronously via the in-process message processor
 */
router.post('/webhook', async (req: Request, res: Response) => {
  console.log('📥 Webhook POST received at', new Date().toISOString());
  console.log('📦 Request body:', JSON.stringify(req.body, null, 2));
  
  // Always return 200 OK immediately to Meta
  // This prevents Meta from retrying the webhook
  res.status(200).send('OK');

  // Validate webhook payload structure
  if (!isValidWebhookPayload(req.body)) {
    console.warn('⚠️ Invalid webhook payload structure:', JSON.stringify(req.body, null, 2));
    return;
  }

  // Extract message data safely
  const extractedMessage = extractMessage(req.body);

  if (!extractedMessage) {
    console.log('📨 Webhook received but no message found (might be status update)');
    return;
  }

  // Log incoming message
  const { phoneNumber, messageText, messageType } = extractedMessage;
  
  // Format phone number for logging (show last 4 digits for privacy)
  const phoneDisplay = phoneNumber.length > 4 
    ? `${phoneNumber.slice(0, -4)}${'*'.repeat(4)}` 
    : phoneNumber;

  if (messageText) {
    console.log(`📨 Incoming message from ${phoneDisplay}: ${messageText}`);
  } else if (messageType === 'image' || messageType === 'video') {
    console.log(`📨 Incoming ${messageType} from ${phoneDisplay}${extractedMessage.caption ? `: ${extractedMessage.caption}` : ''}`);
  } else {
    console.log(`📨 Incoming ${messageType} from ${phoneDisplay}`);
  }

  // Process message synchronously (after responding to Meta)
  processIncomingMessage(extractedMessage).catch((error) => {
    console.error('❌ Error while processing message:', error);
  });
});

export default router;

