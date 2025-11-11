# AlgoIntent Telegram Bot

<div align="center">

**Natural Language Algorand Assistant for Telegram**

[🌐 Main Project](../README.md) | [💻 Source Code](./telegram_bot.py)

</div>

---

## 🎯 Overview

The AlgoIntent Telegram Bot enables users to interact with the Algorand blockchain through natural language commands in Telegram. Simply describe what you want to do in plain English, and the bot will execute the transaction securely.

### Key Features

- 🤖 **AI-Powered Intent Parsing**: Understands natural language commands
- 🔐 **Secure Wallet Management**: Create and connect wallets with password protection
- 💰 **Send ALGO**: Single or multi-recipient transfers
- 🎨 **NFT Creation**: Create NFTs with media uploads to IPFS
- 📦 **Asset Management**: Opt-in/opt-out of Algorand Standard Assets (ASAs)
- 🔒 **Security First**: Passwords never stored, messages auto-deleted
- 🌐 **Network Support**: TestNet and MainNet

---

## 🏗️ Architecture

```
Telegram User
     │
     ▼
Telegram Bot (python-telegram-bot)
     │
     ▼
AI Intent Parser (Perplexity AI)
     │
     ▼
Transaction Builder (Algorand SDK)
     │
     ▼
Algorand Blockchain (TestNet/MainNet)
```

### Core Components

- **`telegram_bot.py`**: Main bot entrypoint and message handlers
- **`ai_intent.py`**: AI-powered intent parsing using Perplexity AI
- **`transaction_builder.py`**: Builds and sends Algorand transactions
- **`wallet.py`**: Wallet creation, connection, and transaction signing
- **`ipfs_utils.py`**: IPFS integration via Pinata for NFT media uploads
- **`utils.py`**: Utility functions for address validation, balance checks, etc.
- **`intent_parser.py`**: Fallback intent parsing helpers

---

## 📋 Prerequisites

- **Python** 3.8 or higher
- **Telegram Bot Token** from [@BotFather](https://t.me/BotFather)
- **Perplexity AI API Key** from [Perplexity AI](https://www.perplexity.ai/)
- **Pinata API Keys** (for IPFS uploads) from [Pinata](https://www.pinata.cloud/)
- **Algorand Node Access** (or use public testnet node)

---

## 🚀 Installation & Setup

### 1. Clone the Repository

```bash
git clone https://github.com/caerlower/algo-intent.git
cd algo-intent/telegram_bot
```

### 2. Install Dependencies

```bash
pip install -r requirements.txt
```

### 3. Environment Configuration

Create a `.env` file in the `telegram_bot/` directory:

```bash
# Telegram Bot Configuration
TELEGRAM_BOT_TOKEN=your_telegram_bot_token_here

# AI Intent Parsing
PERPLEXITY_API_KEY=your_perplexity_api_key_here

# IPFS Configuration (Pinata)
PINATA_API_KEY=your_pinata_api_key
PINATA_API_SECRET=your_pinata_api_secret

# Algorand Node Configuration
ALGOD_ADDRESS=https://testnet-api.algonode.cloud
ALGOD_TOKEN=
ALGOD_PORT=

# Network (testnet or mainnet)
NETWORK=testnet
```

### 4. Get Your API Keys

#### Telegram Bot Token
1. Open Telegram and search for [@BotFather](https://t.me/BotFather)
2. Send `/newbot` and follow the instructions
3. Copy the bot token and add it to `.env`

#### Perplexity AI API Key
1. Visit [Perplexity AI](https://www.perplexity.ai/)
2. Sign up and navigate to API settings
3. Generate an API key
4. Add it to `.env` as `PERPLEXITY_API_KEY`

#### Pinata API Keys (for NFT media uploads)
1. Sign up at [Pinata](https://www.pinata.cloud/)
2. Go to API Keys section
3. Create a new API key with upload permissions
4. Add `PINATA_API_KEY` and `PINATA_API_SECRET` to `.env`

### 5. Run the Bot

```bash
python telegram_bot.py
```

You should see:
```
🤖 Secure Bot started! Ready for public use with message security.
```

---

## 💬 Usage Examples

### Wallet Management

```
create me a new wallet
```

The bot will:
1. Generate a new Algorand wallet
2. Ask you to set a password
3. Provide your wallet address and mnemonic (⚠️ Save this securely!)

```
I want to connect my wallet
```

The bot will ask for your mnemonic phrase to connect an existing wallet.

### Sending ALGO

```
send 2 algos to RUXSTPANLEGZY5BDDA3SWRSG5JME67UYXII65XXI6GSY3HCQRSWMAPKCKY
```

```
send 2 algos to both RUXSTPANLEGZY5BDDA3SWRSG5JME67UYXII65XXI6GSY3HCQRSWMAPKCKY and 6MZK4765UUZFBPAPXZBNXTIRHORJ75KBKRIGHVOB23OQODVMSB6GCL5DVM
```

### NFT Operations

```
Create 10 nfts with name Universe and give it description "This image shows our milky way"
```

To create an NFT with an image:
1. Send an image (photo or video) to the bot
2. Add a caption like: `Create NFT named "Sunset" with description "Evening view"`

```
Opt in for NFT 740574628
```

```
Opt out of NFT 740574628
```

```
Send NFT 740830836 to RUXSTPANLEGZY5BDDA3SWRSG5JME67UYXII65XXI6GSY3HCQRSWMAPKCKY
```

### Balance Check

```
Check my balance
```

---

## 🔒 Security Features

### Password Protection
- All sensitive operations require password confirmation
- Passwords are never stored or logged
- Passwords are deleted from memory immediately after use

### Input Sanitization
- All user inputs are sanitized to prevent injection attacks
- Maximum message length limits
- Dangerous patterns are filtered out

### Rate Limiting
- Maximum 10 transactions per hour per user
- Prevents abuse and spam

### Session Management
- Sessions timeout after 24 hours of inactivity
- Automatic cleanup of sensitive data

### Security Logging
- All security events are logged to `security_events.log`
- Failed password attempts are tracked
- Suspicious activities are flagged

---

## 📁 File Structure

```
telegram_bot/
├── telegram_bot.py          # Main bot entrypoint
├── ai_intent.py              # AI intent parsing (Perplexity AI)
├── intent_parser.py          # Fallback intent parsing
├── transaction_builder.py    # Transaction building and sending
├── wallet.py                 # Wallet creation and management
├── ipfs_utils.py            # IPFS integration (Pinata)
├── utils.py                 # Utility functions
├── requirements.txt         # Python dependencies
├── .env                     # Environment variables (create this)
├── telegram_sessions.json    # User sessions (auto-generated)
├── bot.log                  # Application logs
└── security_events.log      # Security event logs
```

---

## 🛠️ Development

### Running in Development

```bash
# Run with verbose logging
python telegram_bot.py
```

### Testing

Test the bot by sending commands to your bot on Telegram. Make sure you're using testnet ALGO for testing!

### Debugging

- Check `bot.log` for application logs
- Check `security_events.log` for security-related events
- Enable debug logging by modifying the logging level in `telegram_bot.py`

---

## 🔗 Deployed Assets & Testnet

### Testnet Assets

| Asset | Symbol | Asset ID | Explorer |
|-------|--------|----------|----------|
| Algorand | ALGO | 0 | [Explorer](https://lora.algokit.io/testnet/) |
| USD Coin | USDC | 10458941 | [Asset](https://lora.algokit.io/testnet/asset/10458941) |

### Testnet Faucet

Get free testnet ALGO from:
- [Algorand Testnet Faucet](https://bank.testnet.algorand.network/)

### Testnet Explorer

View your transactions:
- [Testnet Explorer](https://lora.algokit.io/testnet/)

---

## 📝 Supported Commands

### Wallet Commands
- `create me a new wallet` - Create a new Algorand wallet
- `I want to connect my wallet` - Connect an existing wallet
- `Disconnect my wallet` - Disconnect current wallet
- `Check my balance` - Check wallet balance

### Transaction Commands
- `send X algos to [ADDRESS]` - Send ALGO to a single address
- `send X algos to both [ADDR1] and [ADDR2]` - Send to multiple addresses
- `send X algos to [ADDR1], [ADDR2], and [ADDR3]` - Send to multiple addresses

### NFT Commands
- `Create NFT named [NAME]` - Create a single NFT
- `Create X nfts with name [NAME]` - Create multiple NFTs
- `Create NFT named [NAME] with description "[DESC]"` - Create NFT with description
- Send image with caption: `Create NFT named [NAME]` - Create NFT with media
- `Opt in for NFT [ASSET_ID]` - Opt-in to an asset
- `Opt out of NFT [ASSET_ID]` - Opt-out of an asset
- `Send NFT [ASSET_ID] to [ADDRESS]` - Transfer NFT

---

## 🐛 Troubleshooting

### Bot Not Responding
- Check that `TELEGRAM_BOT_TOKEN` is correct in `.env`
- Verify the bot is running (`python telegram_bot.py`)
- Check `bot.log` for errors

### Transaction Failed
- Ensure you have sufficient ALGO for transaction fees
- Verify the recipient address is valid
- Check network configuration (testnet vs mainnet)
- View transaction on [Testnet Explorer](https://lora.algokit.io/testnet/)

### NFT Creation Failed
- Verify `PINATA_API_KEY` and `PINATA_API_SECRET` are correct
- Check that image file is not too large
- Ensure wallet has sufficient ALGO for asset creation fees

### Intent Not Understood
- Try rephrasing your command
- Use the example commands from this README
- Check that `PERPLEXITY_API_KEY` is valid

---

## 📊 Transaction Fees

Algorand transactions require minimal fees:
- **Standard Transaction**: ~0.001 ALGO
- **Asset Creation (NFT)**: ~0.1 ALGO
- **Asset Transfer**: ~0.001 ALGO
- **Opt-in**: ~0.001 ALGO

Always ensure your wallet has sufficient ALGO for fees!

---

## 🔄 Updates & Maintenance

### Updating Dependencies

```bash
pip install -r requirements.txt --upgrade
```

### Backup Important Data

- **Sessions**: `telegram_sessions.json` (contains encrypted wallet data)
- **Logs**: `bot.log` and `security_events.log`

⚠️ **Important**: Never share your `.env` file or `telegram_sessions.json` publicly!

---

## 🎥 Demo

- **Telegram YouTube Demo**: [https://youtu.be/gwnjztTM3wI](https://youtu.be/gwnjztTM3wI)

---

## 📜 License

This project is licensed under the MIT License - see the [LICENSE](../LICENSE) file for details.

---

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

---

## 📞 Support

- **Issues**: [GitHub Issues](https://github.com/caerlower/algo-intent/issues)
- **Main README**: [../README.md](../README.md)

---

<div align="center">

**Part of the AlgoIntent Project**

Made with ❤️ for the Algorand community

</div>

