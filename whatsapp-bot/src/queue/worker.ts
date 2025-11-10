/**
 * BullMQ Worker for processing WhatsApp messages
 * 
 * This worker pulls messages from the Redis queue and processes them
 * Processing includes:
 * 1. Logging the message (currently)
 * 2. Parsing intent (Step 3)
 * 3. Executing transactions (Step 4)
 */

import { Worker, Job } from 'bullmq';
import Redis from 'ioredis';
import dotenv from 'dotenv';
import { ExtractedMessage } from '../types/whatsapp';
import { intentEngine } from '../intent/engine';
import { executeTransaction } from '../transaction/executor';
import { sendWhatsAppMessage } from '../whatsapp/sender';

// Load environment variables
dotenv.config();

console.log('🚀 Worker module file executing...');
console.log('📦 Worker module dependencies loaded');

// Redis connection for worker (separate from queue connection)
const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';
console.log(`🔧 Worker Redis URL: ${redisUrl.substring(0, 50)}...`);

const redisConnection = new Redis(redisUrl, {
  maxRetriesPerRequest: null,
  enableReadyCheck: false,
  retryStrategy: (times) => {
    const delay = Math.min(times * 50, 2000);
    console.log(`🔄 Worker Redis retry attempt ${times}, waiting ${delay}ms...`);
    return delay;
  },
});

// Handle Redis connection for worker
redisConnection.on('connect', () => {
  console.log('🔌 Worker Redis connected');
});

redisConnection.on('ready', () => {
  console.log('✅ Worker Redis ready');
});

redisConnection.on('error', (error) => {
  console.error('❌ Worker Redis connection error:', error);
  console.error(`🔍 Worker Redis URL: ${redisUrl}`);
});

redisConnection.on('close', () => {
  console.log('🔌 Worker Redis connection closed');
});

/**
 * Process a WhatsApp message job
 * 
 * @param job - BullMQ job containing message data
 */
async function processMessage(job: Job<ExtractedMessage>) {
  const { phoneNumber, messageText, messageType, messageId } = job.data;

  console.log(`\n🔄 Processing message job ${job.id}...`);
  console.log(`📱 From: ${phoneNumber}`);
  console.log(`💬 Message: ${messageText || `[${messageType}]`}`);
  
  // Format phone number for logging (privacy)
  const phoneDisplay = phoneNumber.length > 4 
    ? `${phoneNumber.slice(0, -4)}${'*'.repeat(4)}` 
    : phoneNumber;

  // Log processing start
  console.log(`⏳ Processing message from ${phoneDisplay}...`);

  // Step 3: Parse intent using AlgoIntent engine
  if (messageText && messageType === 'text') {
    // Check for greetings first
    const normalizedText = messageText.toLowerCase().trim();
    const greetingPatterns = ['hello', 'hi', 'hey', 'greetings', 'hallo', 'hola', 'bonjour'];
    
    if (greetingPatterns.some(pattern => normalizedText.includes(pattern))) {
      const greetingMessage = `👋 Welcome to AlgoIntent!\n\n` +
        `I'm your Algorand assistant. I can help you:\n` +
        `• Send ALGO to addresses or phone numbers\n` +
        `• Check your balance\n` +
        `• Opt-in to assets\n` +
        `• Create and send NFTs\n` +
        `• Answer questions about Algorand\n\n` +
        `Just tell me what you'd like to do in plain English!\n\n` +
        `Example: "Send 2 ALGO to +1234567890" or "Check my balance"`;
      
      console.log(`👋 Greeting detected, sending welcome message`);
      await sendWhatsAppMessage(phoneNumber, greetingMessage);
      
      return {
        success: true,
        messageId,
        phoneNumber,
        intent: 'greeting',
        processedAt: new Date().toISOString(),
      };
    }
    
    console.log('🧠 Parsing intent...');
    
    try {
      const parsedIntent = await intentEngine.parseIntent(messageText);
      
      if (!parsedIntent) {
        console.warn('⚠️ Failed to parse intent');
        
        // Send error reply to user
        const errorMessage = '❌ Sorry, I could not understand your request. Please try rephrasing it. For example: "Send 2 ALGO to +1234567890" or "Check my balance"';
        await sendWhatsAppMessage(phoneNumber, errorMessage);
        
        return {
          success: false,
          messageId,
          phoneNumber,
          error: 'Failed to parse intent',
          processedAt: new Date().toISOString(),
        };
      }

      console.log(`✅ Intent parsed: ${parsedIntent.intent}`);
      console.log(`📋 Parameters:`, JSON.stringify(parsedIntent.parameters, null, 2));
      
      if (parsedIntent.context) {
        console.log(`📝 Context: ${parsedIntent.context}`);
      }

      if (parsedIntent.explanation) {
        console.log(`💡 Explanation: ${parsedIntent.explanation}`);
      }

      // Step 4: Execute transaction based on intent
      console.log('🚀 Executing transaction...');
      const txResult = await executeTransaction(parsedIntent, phoneNumber);

      // Step 5: Send WhatsApp reply
      let replyMessage = '';
      if (txResult.success) {
        // Transaction executor already includes TxID in the message, so use it directly
        replyMessage = txResult.message || `✅ Transaction completed successfully`;
      } else {
        // Prioritize transaction error message over intent explanation
        // Only use explanation if there's no specific error message
        if (txResult.message) {
          replyMessage = txResult.message;
        } else if (txResult.error) {
          replyMessage = `❌ Transaction failed: ${txResult.error}`;
        } else if (parsedIntent.explanation) {
          // Use explanation as fallback for informational responses
          replyMessage = parsedIntent.explanation;
        } else {
          replyMessage = '❌ Transaction failed: Unknown error';
        }
      }

      console.log(`📨 Reply message: ${replyMessage.substring(0, 100)}...`);
      console.log(`📊 Transaction result: success=${txResult.success}, error=${txResult.error || 'none'}`);

      console.log(`📤 Sending WhatsApp reply to ${phoneDisplay}...`);
      const sendResult = await sendWhatsAppMessage(phoneNumber, replyMessage);
      
      if (!sendResult.success) {
        console.error(`❌ Failed to send WhatsApp reply: ${sendResult.error}`);
      } else {
        console.log(`✅ WhatsApp reply sent successfully`);
      }

      console.log(`✅ Message processed successfully (Job ${job.id})`);
      
      return {
        success: txResult.success,
        messageId,
        phoneNumber,
        intent: parsedIntent.intent,
        parameters: parsedIntent.parameters,
        txid: txResult.txid,
        replySent: sendResult.success,
        processedAt: new Date().toISOString(),
      };
    } catch (error) {
      console.error('❌ Error parsing intent:', error);
      
      // Send error reply to user
      const errorMessage = '❌ Sorry, an error occurred while processing your request. Please try again later.';
      await sendWhatsAppMessage(phoneNumber, errorMessage);
      
      return {
        success: false,
        messageId,
        phoneNumber,
        error: error instanceof Error ? error.message : 'Unknown error',
        processedAt: new Date().toISOString(),
      };
    }
  } else {
    // Non-text messages (images, videos, etc.) - not supported yet
    console.log(`⚠️ Non-text message type (${messageType}) - not supported yet`);
    
    // Send reply to user
    const errorMessage = '❌ Sorry, I can only process text messages at the moment. Please send your request as text, for example: "Send 2 ALGO to +1234567890" or "Check my balance"';
    await sendWhatsAppMessage(phoneNumber, errorMessage);
    
    return {
      success: false,
      messageId,
      phoneNumber,
      error: `Message type ${messageType} not supported`,
      processedAt: new Date().toISOString(),
    };
  }
}

/**
 * BullMQ Worker instance
 * 
 * Processes jobs from the 'whatsapp-messages' queue
 */
let messageWorker: Worker<ExtractedMessage>;

try {
  console.log('🔧 Creating BullMQ Worker instance...');
  messageWorker = new Worker<ExtractedMessage>(
    'whatsapp-messages',
    async (job: Job<ExtractedMessage>) => {
      console.log(`\n🎯 Worker received job ${job.id} - starting processing...`);
      return await processMessage(job);
    },
    {
      connection: redisConnection,
      concurrency: 5, // Process up to 5 messages concurrently
      limiter: {
        max: 10, // Max 10 jobs per interval
        duration: 1000, // Per 1 second (rate limiting)
      },
    }
  );

  console.log('✅ Worker instance created successfully');
  console.log('👷 Worker instance created, waiting for Redis connection...');
  console.log(`🔍 Worker will listen on queue: whatsapp-messages`);
  console.log(`🔍 Worker Redis URL: ${redisUrl.substring(0, 50)}...`);
} catch (error) {
  console.error('❌ Failed to create worker:', error);
  throw error;
}

export { messageWorker };

// Worker event handlers
messageWorker.on('completed', (job) => {
  const { phoneNumber, messageText } = job.data;
  const phoneDisplay = phoneNumber.length > 4 
    ? `${phoneNumber.slice(0, -4)}${'*'.repeat(4)}` 
    : phoneNumber;
  
  console.log(`✅ Job ${job.id} completed: Message from ${phoneDisplay} processed`);
});

messageWorker.on('failed', (job, err) => {
  const phoneDisplay = job?.data?.phoneNumber 
    ? (job.data.phoneNumber.length > 4 
        ? `${job.data.phoneNumber.slice(0, -4)}${'*'.repeat(4)}` 
        : job.data.phoneNumber)
    : 'unknown';
  
  console.error(`❌ Job ${job?.id} failed:`, err.message);
  console.error(`   Message from: ${phoneDisplay}`);
});

messageWorker.on('error', (err) => {
  console.error('❌ Worker error:', err);
});

messageWorker.on('active', (job) => {
  console.log(`\n🔄 Worker started processing job ${job.id}`);
});

messageWorker.on('ready', () => {
  console.log('👷 Message worker started and ready to process jobs');
  console.log(`🔍 Worker listening on queue: whatsapp-messages`);
  console.log(`📊 Worker concurrency: 5`);
  
  // Test: Check if there are any waiting jobs
  redisConnection.get('bull:whatsapp-messages:meta', (err, result) => {
    if (!err) {
      console.log(`🔍 Queue metadata check: ${result || 'No metadata found'}`);
    }
  });
});

messageWorker.on('stalled', (jobId) => {
  console.warn(`⚠️ Job ${jobId} stalled - might be taking too long`);
});

// Graceful shutdown
process.on('SIGTERM', async () => {
  console.log('🛑 Shutting down worker gracefully...');
  await messageWorker.close();
  await redisConnection.quit();
  process.exit(0);
});

process.on('SIGINT', async () => {
  console.log('🛑 Shutting down worker gracefully...');
  await messageWorker.close();
  await redisConnection.quit();
  process.exit(0);
});

export default messageWorker;

