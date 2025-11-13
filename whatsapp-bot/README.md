# AlgoIntent WhatsApp Bot

WhatsApp-based Web3 assistant for Algorand blockchain transactions using natural language.

## 🎯 Overview

This bot allows users to interact with the Algorand blockchain through WhatsApp using simple messages like:
- "Send 2 ALGO to +573001234567"
- "Check my balance"
- "Opt-in ASA 12345"

## 🏗️ Architecture

```
WhatsApp → Meta Cloud API → Express Webhook → Message Processor → AlgoIntent Engine → Wallet → Algorand
```

## 📋 Prerequisites

- Node.js 18+ 
- npm or yarn
- Meta WhatsApp Cloud API credentials:
  - App ID
  - Access Token
  - Phone Number ID
  - Verify Token (you create this)

## 🚀 Quick Start

**For detailed setup instructions, see [SETUP.md](./SETUP.md)**

1. **Install dependencies:**
   ```bash
   npm install
   ```

2. **Configure environment variables:**
   ```bash
   cp env.example .env
   ```
   
   Edit `.env` and add your credentials (see `SETUP.md` for details):
   - WhatsApp Access Token (from Meta Developer Console)
   - Verify Token (create a random secret string)
   - Phone Number ID: `863072956888721` (already configured)
   - App ID: `842628281464022` (already configured)

3. **Build TypeScript:**
   ```bash
   npm run build
   ```

4. **Run in development mode:**
   ```bash
   npm run dev
   ```

5. **Run in production mode:**
   ```bash
   npm start
   ```

## 🔗 Webhook Setup

### Meta Developer Console Configuration

1. Go to [Meta for Developers](https://developers.facebook.com/)
2. Navigate to your WhatsApp app
3. Go to Configuration → Webhooks
4. Set webhook URL: `https://your-domain.com/webhook`
5. Set verify token: (same as `WHATSAPP_VERIFY_TOKEN` in `.env`)
6. Subscribe to: `messages`, `message_status`

### Local Development (ngrok)

For local testing, use ngrok to expose your local server:

```bash
ngrok http 3001
```

Then use the ngrok URL in Meta webhook configuration.

## 📡 API Endpoints

- `GET /webhook` - Webhook verification (Meta calls this)
- `POST /webhook` - Receives incoming messages (Meta calls this)
- `GET /health` - Health check endpoint

## 📝 Example Usage

When a user sends a WhatsApp message:
```
User: "Send 2 ALGO to +573001234567"
```

The server logs:
```
📨 Incoming message from +919876****: Send 2 ALGO to +573001234567
📋 Message details: {
  "phoneNumber": "+919876543210",
  "messageText": "Send 2 ALGO to +573001234567",
  "messageId": "wamid.xxx",
  ...
}
```

## 🔐 Security

- Webhook verification token prevents unauthorized access
- All sensitive data is logged with masked phone numbers
- Environment variables store all secrets

## 🛠️ Development

```bash
# Watch mode (auto-restart on changes)
npm run watch

# Build TypeScript
npm run build

# Run production build
npm start
```

## 📄 License

MIT

