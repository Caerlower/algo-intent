/**
 * AlgoIntent WhatsApp Bot - Main Entry Point
 * 
 * Express server that handles WhatsApp webhooks from Meta Cloud API
 * 
 * Flow:
 * 1. Receives webhooks from Meta (GET for verification, POST for messages)
 * 2. Validates and extracts message data
 * 3. Logs messages (later: pushes to queue for async processing)
 * 4. Processes intents via AlgoIntent engine
 * 5. Executes Algorand transactions via Hashi + Vault
 * 6. Sends replies back to users via WhatsApp
 */

import express, { Express } from 'express';
import bodyParser from 'body-parser';
import dotenv from 'dotenv';
import webhookRouter from './webhook/webhook';

// Load environment variables from .env file
dotenv.config();

// Import worker AFTER dotenv.config() to ensure env vars are loaded
// This will execute the worker.ts module and start the worker
import messageWorker from './queue/worker';

// Verify worker was imported
if (!messageWorker) {
  console.error('❌ Worker module failed to import!');
  process.exit(1);
}

console.log('✅ Worker module imported and initialized');

/**
 * Initialize Express application
 */
const app: Express = express();
const PORT = process.env.PORT || 3001;

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

// Start server
app.listen(PORT, () => {
  console.log('🚀 AlgoIntent WhatsApp Bot server started');
  console.log(`📡 Listening on port ${PORT}`);
  console.log(`🔗 Webhook URL: http://localhost:${PORT}/webhook`);
  console.log(`✅ Health check: http://localhost:${PORT}/health`);
  
  // Validate required environment variables
  const requiredEnvVars = [
    'WHATSAPP_ACCESS_TOKEN',
    'WHATSAPP_VERIFY_TOKEN',
    'WHATSAPP_PHONE_NUMBER_ID'
  ];
  
  const missingVars = requiredEnvVars.filter(varName => !process.env[varName]);
  
  if (missingVars.length > 0) {
    console.warn('⚠️ Missing environment variables:', missingVars.join(', '));
    console.warn('⚠️ Please check your .env file');
  } else {
    console.log('✅ All required environment variables are set');
    console.log(`📱 Phone Number ID: ${process.env.WHATSAPP_PHONE_NUMBER_ID}`);
    console.log(`🔐 App ID: ${process.env.WHATSAPP_APP_ID || 'Not set'}`);
  }

  // Check Redis URL
  if (process.env.REDIS_URL) {
    console.log(`✅ Redis URL configured: ${process.env.REDIS_URL.substring(0, 30)}...`);
  } else {
    console.warn('⚠️ REDIS_URL not set, using default: redis://localhost:6379');
  }

  // Check Perplexity API Key
  if (process.env.PERPLEXITY_API_KEY) {
    console.log('✅ Intent Engine configured (Perplexity API)');
  } else {
    console.warn('⚠️ PERPLEXITY_API_KEY not set - intent parsing will not work');
  }

  // Worker is automatically started when imported
  // It will process messages from the queue
  console.log('👷 Message worker is running and ready to process jobs');
});

// Graceful shutdown
process.on('SIGTERM', async () => {
  console.log('🛑 SIGTERM received, shutting down gracefully');
  // Worker handles its own shutdown
  process.exit(0);
});

process.on('SIGINT', async () => {
  console.log('🛑 SIGINT received, shutting down gracefully');
  // Worker handles its own shutdown
  process.exit(0);
});

