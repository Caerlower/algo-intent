/**
 * Redis connection and BullMQ queue setup
 * Handles connection to Redis and creates message processing queue
 */

import { Queue } from 'bullmq';
import Redis from 'ioredis';
import dotenv from 'dotenv';
import { ExtractedMessage } from '../types/whatsapp';

// Load environment variables
dotenv.config();

// Redis connection configuration
const redisConnection = new Redis(process.env.REDIS_URL || 'redis://localhost:6379', {
  maxRetriesPerRequest: null,
  enableReadyCheck: false,
});

// Handle Redis connection events
redisConnection.on('connect', () => {
  console.log('🔌 Redis connected');
  console.log(`🔗 Redis URL: ${process.env.REDIS_URL ? 'Using Redis Cloud' : 'Using localhost'}`);
});

redisConnection.on('error', (error) => {
  console.error('❌ Redis connection error:', error);
  console.error(`🔍 Attempted to connect to: ${process.env.REDIS_URL || 'redis://localhost:6379'}`);
});

redisConnection.on('close', () => {
  console.log('🔌 Redis connection closed');
});

/**
 * Queue for processing WhatsApp messages
 * 
 * Jobs in this queue will be processed by the worker
 * Each job contains message data extracted from WhatsApp webhook
 */
export const messageQueue = new Queue<ExtractedMessage>('whatsapp-messages', {
  connection: redisConnection,
  defaultJobOptions: {
    attempts: 3, // Retry up to 3 times on failure
    backoff: {
      type: 'exponential',
      delay: 2000, // Start with 2 seconds delay
    },
    removeOnComplete: {
      age: 3600, // Keep completed jobs for 1 hour
      count: 1000, // Keep last 1000 completed jobs
    },
    removeOnFail: {
      age: 86400, // Keep failed jobs for 24 hours
    },
  },
});

/**
 * Add a message to the processing queue
 * 
 * @param message - Extracted message data from WhatsApp webhook
 * @returns Promise resolving to the job ID
 */
export async function addMessageToQueue(message: ExtractedMessage): Promise<string> {
  try {
    const job = await messageQueue.add('process-message', message, {
      jobId: `msg-${message.messageId}`, // Use message ID as job ID to prevent duplicates
    });
    
    console.log(`✅ Message added to queue: Job ${job.id}`);
    console.log(`📋 Queue name: whatsapp-messages`);
    
    // Log queue stats for debugging
    const stats = await getQueueStats();
    console.log(`📊 Queue stats: ${stats.waiting} waiting, ${stats.active} active`);
    
    return job.id!;
  } catch (error) {
    console.error('❌ Error adding message to queue:', error);
    throw error;
  }
}

/**
 * Get queue statistics
 * 
 * @returns Queue stats (waiting, active, completed, failed counts)
 */
export async function getQueueStats() {
  const [waiting, active, completed, failed] = await Promise.all([
    messageQueue.getWaitingCount(),
    messageQueue.getActiveCount(),
    messageQueue.getCompletedCount(),
    messageQueue.getFailedCount(),
  ]);

  return {
    waiting,
    active,
    completed,
    failed,
  };
}

/**
 * Close Redis connection gracefully
 */
export async function closeRedisConnection() {
  await redisConnection.quit();
  console.log('🔌 Redis connection closed gracefully');
}

export default messageQueue;

