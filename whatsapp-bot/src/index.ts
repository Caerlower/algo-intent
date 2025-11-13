/**
 * AlgoIntent WhatsApp Bot - Main Entry Point
 * 
 * Express server that handles WhatsApp webhooks from Meta Cloud API
 * 
 * Flow:
 * 1. Receives webhooks from Meta (GET for verification, POST for messages)
 * 2. Validates and extracts message data
 * 3. Logs messages and processes them synchronously
 * 4. Processes intents via AlgoIntent engine
 * 5. Executes Algorand transactions via Hashi + Vault
 * 6. Sends replies back to users via WhatsApp
 */

import express, { Express } from 'express';
import bodyParser from 'body-parser';
import dotenv from 'dotenv';
import webhookRouter from './webhook/webhook';
import {
  getActiveMessageCount,
  markMessageProcessorShuttingDown,
  waitForMessageProcessingToComplete,
} from './messageProcessor';

// Load environment variables from .env file
dotenv.config();

/**
 * Initialize Express application
 */
const app: Express = express();
const PORT = process.env.PORT || 3001;
let isShuttingDown = false;

// Middleware configuration
// Parse JSON bodies (Meta sends JSON webhooks)
app.use(bodyParser.json());

// Parse URL-encoded bodies (for webhook verification query params)
app.use(bodyParser.urlencoded({ extended: true }));

// Request logging middleware
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`);
  next();
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    service: 'AlgoIntent WhatsApp Bot',
    timestamp: new Date().toISOString()
  });
});

// Webhook routes
app.use('/', webhookRouter);

// Error handling middleware
app.use((err: Error, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error('❌ Error:', err);
  res.status(500).json({ error: 'Internal server error' });
});

const server = app.listen(PORT, () => {
  console.log('🚀 AlgoIntent WhatsApp Bot server started');
  console.log(`📡 Listening on port ${PORT}`);
  console.log(`🔗 Webhook URL: http://localhost:${PORT}/webhook`);
  console.log(`✅ Health check: http://localhost:${PORT}/health`);

  // Validate required environment variables
  const requiredEnvVars = [
    'WHATSAPP_ACCESS_TOKEN',
    'WHATSAPP_VERIFY_TOKEN',
    'WHATSAPP_PHONE_NUMBER_ID',
  ];

  const missingVars = requiredEnvVars.filter((varName) => !process.env[varName]);

  if (missingVars.length > 0) {
    console.warn('⚠️ Missing environment variables:', missingVars.join(', '));
    console.warn('⚠️ Please check your .env file');
  } else {
    console.log('✅ All required environment variables are set');
    console.log(`📱 Phone Number ID: ${process.env.WHATSAPP_PHONE_NUMBER_ID}`);
    console.log(`🔐 App ID: ${process.env.WHATSAPP_APP_ID || 'Not set'}`);
  }

  // Check Perplexity API Key
  if (process.env.PERPLEXITY_API_KEY) {
    console.log('✅ Intent Engine configured (Perplexity API)');
  } else {
    console.warn('⚠️ PERPLEXITY_API_KEY not set - intent parsing will not work');
  }
});

async function shutdown(signal: string) {
  if (isShuttingDown) {
    console.log(`🔁 ${signal} received, shutdown already in progress`);
    return;
  }

  isShuttingDown = true;

  console.log(`🛑 ${signal} received, shutting down gracefully`);

  markMessageProcessorShuttingDown();

  await new Promise<void>((resolve) => {
    server.close((error?: Error) => {
      if (error) {
        console.error('❌ Error closing HTTP server:', error);
      } else {
        console.log('✅ HTTP server closed to new connections');
      }
      resolve();
    });
  });

  const timeoutEnv = process.env.SHUTDOWN_TIMEOUT_MS
    ? Number(process.env.SHUTDOWN_TIMEOUT_MS)
    : undefined;
  const timeoutMs =
    typeof timeoutEnv === 'number' && !Number.isNaN(timeoutEnv) && timeoutEnv > 0
      ? timeoutEnv
      : 10_000;

  await waitForMessageProcessingToComplete(timeoutMs);

  const remaining = getActiveMessageCount();
  if (remaining > 0) {
    console.warn(`⚠️ Exiting with ${remaining} message(s) still processing.`);
  } else {
    console.log('✅ All message processing completed.');
  }

  console.log('👋 Shutdown complete. Exiting process.');
  process.exit(0);
}

// Graceful shutdown
process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

