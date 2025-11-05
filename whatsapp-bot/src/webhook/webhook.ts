/**
 * WhatsApp webhook routes for Meta Cloud API
 * Handles webhook verification and incoming message processing
 */

import { Request, Response, Router } from 'express';
import { extractMessage, isValidWebhookPayload } from './extractMessage';
import { WebhookVerificationQuery } from '../types/whatsapp';
import { addMessageToQueue } from '../queue/queue';

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
  const query = req.query as unknown as WebhookVerificationQuery;
  
  const mode = query['hub.mode'];
  const token = query['hub.verify_token'];
  const challenge = query['hub.challenge'];

  // Verify that this is a subscription request
  if (mode === 'subscribe' && token === process.env.WHATSAPP_VERIFY_TOKEN) {
    console.log('✅ Webhook verified successfully');
    res.status(200).send(challenge);
  } else {
    console.error('❌ Webhook verification failed:', {
      mode,
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
 * Processes messages asynchronously:
 * 1. Extracts message data safely
 * 2. Pushes message to Redis queue for async processing
 * 3. Returns 200 OK immediately to Meta
 * 
 * The worker process will handle actual message processing
 */
router.post('/webhook', async (req: Request, res: Response) => {
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

  // Push message to queue for async processing
  try {
    const jobId = await addMessageToQueue(extractedMessage);
    console.log(`📤 Message queued for processing: Job ${jobId}`);
  } catch (error) {
    console.error('❌ Failed to queue message:', error);
    // Note: We already returned 200 OK, so Meta won't retry
    // In production, you might want to log this to a monitoring service
  }
});

export default router;

