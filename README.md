# AlgoIntent

<div align="center">

**Natural Language Interface for Algorand Blockchain**

[🌐 Live Web App](https://www.algointent.xyz/) | [📱 Telegram Bot](#telegram-bot) | [💬 WhatsApp Bot](#whatsapp-bot) | [📖 Documentation](./algointent/projects/algointent/README.md)

</div>

- **Setup Video Link**: https://youtu.be/WtcqSkpF934

---

## 🎯 Overview

**AlgoIntent** is a revolutionary multi-platform interface that enables users to interact with the Algorand blockchain using natural language. Instead of navigating complex interfaces or writing code, users simply describe what they want to do in plain English, and AlgoIntent translates their intent into secure Algorand transactions.

### Why AlgoIntent?

- **🚀 Zero Learning Curve**: No need to understand blockchain jargon or technical details
- **💬 Natural Language**: "Send 2 ALGO to John" works just like you'd say it
- **🔒 Secure**: Leverages Algorand's secure transaction model with wallet integration
- **🌐 Multi-Platform**: Available as a web app, Telegram bot, and WhatsApp bot
- **⚡ Fast**: Built on Algorand's high-performance blockchain
- **🎨 Modern UI**: Beautiful, responsive web interface with wallet connectivity

---

## 🏗️ Architecture

AlgoIntent consists of three main components:

### 1. **Web Application** (`algointent/`)
- **Tech Stack**: React + TypeScript + Vite + Tailwind CSS
- **Features**: 
  - Conversational chat interface
  - Wallet connectivity (Pera, Defly, Exodus)
  - Integrated swap widget (Tinyman v2)
  - Real-time price tracking
  - Atomic transaction support
- **Deployment**: [https://www.algointent.xyz/](https://www.algointent.xyz/)

### 2. **Telegram Bot** (`telegram_bot/`)
- **Tech Stack**: Python + python-telegram-bot
- **Features**:
  - Wallet creation and management
  - NFT creation with IPFS uploads
  - Multi-recipient transfers
  - Password-protected transactions
- **See**: [Telegram Bot README](./telegram_bot/README.md)

### 3. **WhatsApp Bot** (`whatsapp-bot/`)
- **Tech Stack**: TypeScript + Node.js + Express
- **Features**:
  - Queue-based message processing
  - Redis for job management
  - Vault integration for secure key storage
  - Multi-asset support
- **See**: [WhatsApp Bot README](./whatsapp-bot/README.md)

### Core Components

```
┌─────────────────────────────────────────────────────────────┐
│                    User Interface Layer                      │
│  (Web App / Telegram Bot / WhatsApp Bot)                    │
└──────────────────────┬──────────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────────┐
│                  AI Intent Parser                            │
│    (Groq API - Natural Language → Structured Intent)        │
└──────────────────────┬──────────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────────┐
│              Transaction Service Layer                       │
│  (Algorand SDK / AlgoKit Utils / Tinyman SDK)               │
└──────────────────────┬──────────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────────┐
│                  Algorand Blockchain                         │
│              (Testnet / Mainnet)                             │
└─────────────────────────────────────────────────────────────┘
```

---

## 🚀 Quick Start

### Prerequisites

- **Node.js** 20+ and npm 9+ (for web app and WhatsApp bot)
- **Python** 3.8+ (for Telegram bot)
- **Algorand Wallet** (Pera, Defly, or Exodus for web app)
- **API Keys**:
  - Groq API key (for intent parsing)
  - Pinata API keys (for IPFS uploads - Telegram bot)
  - Meta WhatsApp Cloud API credentials (for WhatsApp bot)

### Web Application

```bash
# Navigate to web app directory
cd algointent/projects/algointent

# Install dependencies
npm install

# Create environment file
cp env.template .env

# Add your API keys to .env
# VITE_GROQ_API_KEY=your_key_here
# VITE_ALGOD_ADDRESS=https://testnet-api.algonode.cloud
# VITE_NETWORK=testnet

# Start development server
npm run dev

# Build for production
npm run build
```

**Live Demo**: [https://www.algointent.xyz/](https://www.algointent.xyz/)

### Telegram Bot

```bash
# Navigate to Telegram bot directory
cd telegram_bot

# Install dependencies
pip install -r requirements.txt

# Create .env file with:
# TELEGRAM_BOT_TOKEN=your_bot_token
# GROQ_API_KEY=your_api_key
# PINATA_API_KEY=your_pinata_key
# PINATA_API_SECRET=your_pinata_secret
# ALGOD_ADDRESS=https://testnet-api.algonode.cloud

# Run the bot
python telegram_bot.py
```

**See**: [Telegram Bot README](./telegram_bot/README.md) for detailed setup

### WhatsApp Bot

```bash
# Navigate to WhatsApp bot directory
cd whatsapp-bot

# Install dependencies
npm install

# Create .env file (see whatsapp-bot/README.md for details)
# Build TypeScript
npm run build

# Run in development
npm run dev

# Run in production
npm start
```

**See**: [WhatsApp Bot README](./whatsapp-bot/README.md) for detailed setup

---

## 📋 Supported Operations

### Wallet Operations
- ✅ Send ALGO to single or multiple recipients
- ✅ Send assets (USDC, etc.) to recipients
- ✅ Check wallet balance
- ✅ Create and manage wallets
- ✅ Connect/disconnect wallets

### NFT Operations
- ✅ Create NFTs with custom names and descriptions
- ✅ Upload NFT media to IPFS (Telegram bot)
- ✅ Transfer NFTs to recipients
- ✅ Opt-in/opt-out of assets

### Trading Operations (Web App)
- ✅ Swap tokens via Tinyman v2 (ALGO ↔ USDC)
- ✅ Real-time price quotes
- ✅ Integrated swap widget

### Advanced Features
- ✅ Atomic transactions (multiple actions in one transaction)
- ✅ Multi-recipient transfers
- ✅ Transaction history tracking
- ✅ Real-time price updates

---

## 🔗 Deployed Assets & Contracts

### Testnet Assets

| Asset | Symbol | Asset ID | Explorer Link |
|-------|--------|----------|---------------|
| Algorand | ALGO | 0 | [View on Explorer](https://lora.algokit.io/testnet/) |
| USD Coin | USDC | 10458941 | [View Asset](https://lora.algokit.io/testnet/asset/10458941) |
| TinyUSDC | TINYUSDC | 21582668 | [View Asset](https://lora.algokit.io/testnet/asset/21582668) |

### Smart Contracts

AlgoIntent uses the following Algorand protocols:

- **Tinyman v2 DEX**: For token swaps
  - Pool contracts deployed on Algorand Testnet
  - [Tinyman Documentation](https://docs.tinyman.org/)

### Network Information

- **Testnet Explorer**: [https://lora.algokit.io/testnet/](https://lora.algokit.io/testnet/)
- **Mainnet Explorer**: [https://lora.algokit.io/mainnet/](https://lora.algokit.io/mainnet/)
- **Algorand Testnet Faucet**: [https://bank.testnet.algorand.network/](https://bank.testnet.algorand.network/)

---

## 💡 Example Usage

### Web Application

Visit [https://www.algointent.xyz/app](https://www.algointent.xyz/app) and try:

```
"Send 2 ALGO to ABC123..."
"Check my balance"
"Swap 10 ALGO for USDC"
"Create an NFT named MyArt"
"Send 1 ALGO and 5 USDC to ABC123..."
"Send 2 ALGO to ADDR1 and opt in for asset 123456"
```

### Telegram Bot

```
create me a new wallet
send 5 algos to RUXSTPANLEGZY5BDDA3SWRSG5JME67UYXII65XXI6GSY3HCQRSWMAPKCKY
Create 10 nfts with name Universe and description "This image shows our milky way"
send 2 algos to both RUXSTPANLEGZY5BDDA3SWRSG5JME67UYXII65XXI6GSY3HCQRSWMAPKCKY and 6MZK4765UUZFBPAPXZBNXTIRHORJ75KBKRIGHVOB23OQODVMSB6GCL5DVM
Opt in for NFT 740574628
```

### WhatsApp Bot

```
Send 2 ALGO to +1234567890
Check my balance
Opt-in ASA 12345
```

---

## 🛠️ Technology Stack

### Frontend (Web App)
- **Framework**: React 18 + TypeScript
- **Build Tool**: Vite
- **Styling**: Tailwind CSS + shadcn/ui
- **Routing**: React Router DOM
- **State Management**: React Hooks + TanStack Query
- **Wallet Integration**: `@txnlab/use-wallet-react`
- **Social Login**: Google OAuth with HashiCorp Vault backend for secure key management
- **Algorand SDK**: `algosdk` + `@algorandfoundation/algokit-utils`
- **Trading**: `@tinymanorg/tinyman-swap-widget-sdk`

### Backend Services
- **AI Intent Parsing**: Groq API
- **IPFS Storage**: Pinata API
- **Social Login Backend**: HashiCorp Vault API for secure wallet key storage and transaction signing
- **Blockchain**: Algorand Testnet/Mainnet
- **DEX Integration**: Tinyman v2

### Telegram Bot
- **Language**: Python 3.8+
- **Framework**: python-telegram-bot
- **Algorand SDK**: `py-algorand-sdk`

### WhatsApp Bot
- **Language**: TypeScript
- **Runtime**: Node.js 18+
- **Framework**: Express.js
- **Queue System**: BullMQ + Redis
- **Vault**: HashiCorp Vault (for key management)

---

## 📁 Repository Structure

```
algo-intent/
├── README.md                    # This file
├── algointent/                  # Web application
│   └── projects/algointent/
│       ├── src/
│       │   ├── components/      # React components
│       │   ├── services/        # Business logic & API services
│       │   ├── pages/           # Page components
│       │   └── utils/           # Utility functions
│       ├── package.json
│       └── README.md
├── telegram_bot/                # Telegram bot (Python)
│   ├── telegram_bot.py          # Main bot entrypoint
│   ├── ai_intent.py             # AI intent parsing
│   ├── transaction_builder.py    # Transaction building
│   ├── wallet.py                # Wallet management
│   ├── ipfs_utils.py            # IPFS integration
│   └── README.md                # Telegram bot documentation
└── whatsapp-bot/                # WhatsApp bot (TypeScript)
    ├── src/
    │   ├── index.ts             # Main entrypoint
    │   ├── intent/              # Intent parsing engine
    │   ├── transaction/         # Transaction execution
    │   ├── wallet/              # Wallet management
    │   └── webhook/             # WhatsApp webhook handlers
    └── README.md                # WhatsApp bot documentation
```

---

## 🔒 Security

- **No Key Storage**: Private keys are never stored on servers
- **Wallet Integration**: Web app uses secure wallet connectors (Pera, Defly, Exodus)
- **Password Protection**: Telegram bot requires passwords for sensitive operations
- **Input Sanitization**: All user inputs are sanitized to prevent injection attacks
- **Rate Limiting**: Protection against abuse and spam
- **Ephemeral Data**: Sensitive data (mnemonics, passwords) are deleted immediately after use

---

## 🌐 Network Support

| Network | Status | Explorer | Notes |
|---------|--------|----------|-------|
| **Testnet** | ✅ Fully Supported | [lora.algokit.io/testnet](https://lora.algokit.io/testnet/) | Recommended for testing |
| **Mainnet** | ⚠️ Beta | [lora.algokit.io/mainnet](https://lora.algokit.io/mainnet/) | Use with caution |

---

## 🧩 Key Features

### AI-Powered Intent Parsing
- Natural language understanding via Groq API
- Context-aware responses
- Multi-intent support (e.g., "Send ALGO and opt-in to asset")

### Atomic Transactions
- Execute multiple operations in a single transaction
- Ensures all-or-nothing execution
- Reduces transaction fees

### Multi-Platform Support
- **Web**: Modern, responsive interface with wallet connectivity
- **Telegram**: Conversational bot with media support
- **WhatsApp**: Queue-based processing for scalability

### DeFi Integration
- Tinyman v2 DEX integration for token swaps
- Real-time price quotes
- Seamless trading experience

---

## 🤝 Contributing

We welcome contributions! Please feel free to submit a Pull Request.

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

---

## 📜 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

---

## 🙋 FAQ

**Q: Can I use this on mainnet?**  
A: Yes, but it's currently in beta. Change your network configuration to mainnet and ensure you have sufficient ALGO for fees.

**Q: Is my wallet information safe?**  
A: Yes. The web app never stores your private keys - all transactions are signed by your connected wallet. The Telegram bot encrypts and deletes sensitive data immediately after use.

**Q: How does the AI understand my commands?**  
A: We use Groq API (`llama-3.3-70b-versatile`) to parse natural language into structured intents, which are then executed as Algorand transactions.

**Q: What wallets are supported?**  
A: Web app supports Pera Wallet, Defly, and Exodus. Telegram and WhatsApp bots manage wallets internally.

**Q: Can I create custom NFTs?**  
A: Yes! The Telegram bot supports creating NFTs with custom names, descriptions, and media uploads to IPFS.

---

## 🎥 Demo

- **Live Web App**: [https://www.algointent.xyz/](https://www.algointent.xyz/)

---

## 📞 Support

- **Issues**: [GitHub Issues](https://github.com/caerlower/algo-intent/issues)
- **Documentation**: See individual README files in each component directory

---

<div align="center">

**Built for Build For Hack Series 2025**

Made with ❤️ for the Algorand community

</div>
