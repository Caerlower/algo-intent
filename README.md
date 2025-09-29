# Algo-Intent

Algo-Intent is a dual-experience project for the Algorand ecosystem:

- A conversational, AI-powered Telegram bot to manage wallets, transfer ALGO, mint/transfer NFTs, and more.
- A modern web app (Vite + React + TypeScript + Tailwind) named `algointent` that brings similar intent-driven actions to the browser with wallet connectivity and a swap widget.

Both experiences share the same vision: describe what you want to do in plain English, and let the system translate that into secure Algorand transactions.

---

## 🚀 Key Features

- **AI Intent Parsing**: Natural language to Algorand actions (Telegram bot and web app).
- **Secure Wallet Management**: Create/connect/disconnect wallets with password protection (bot) and browser wallet connect (web).
- **Send ALGO**: Single or multi-recipient transfers, including atomic groups (bot).
- **NFT Support**: Create NFTs with media, transfer NFTs, opt-in/out (bot).
- **IPFS Integration**: Upload NFT media to IPFS via Pinata (bot).
- **Swap Widget**: Integrated trading experience in the web app.
- **Permission-Based Security**: Explicit password confirmation for transactions (bot).
- **Ephemeral Sensitive Data**: Passwords/mnemonics never persisted; messages auto-deleted (bot).
- **Network Flexibility**: TestNet and MainNet supported.

---

## 🔭 In Progress

- **DeFi integrations**: DEX aggregation, liquidity provision, and yield opportunities in the web app.
- **Calendar integration**: Schedule future transactions, recurring transfers, and smart reminders.
- **Social login**: OAuth-based sign-in (e.g., Google/Apple) for smoother onboarding and linking wallets.
- **And more**: Additional wallet connectors, richer analytics, and expanded asset support.

---

## 🧭 Repository Layout

```
algo-intent/
├── README.md
├── telegram_bot/                      # Telegram bot implementation (Python)
│   ├── ai_intent.py                   # AI intent parsing
│   ├── app.py                         # Optional app bootstrap
│   ├── intent_parser.py               # Intent parsing helpers
│   ├── ipfs_utils.py                  # IPFS (Pinata) helpers
│   ├── telegram_bot.py                # Main Telegram bot entrypoint
│   ├── transaction_builder.py         # Transaction building/sending
│   ├── utils.py                       # Shared utilities
│   ├── wallet.py                      # Wallet and encryption helpers
│   └── requirements.txt               # Python dependencies
└── algointent/                        # Web app workspace (Vite + React + TS)
    ├── algointent.code-workspace
    └── projects/algointent/
        ├── package.json               # Frontend dependencies/scripts
        ├── public/
        │   ├── index.html
        │   └── robots.txt
        └── src/
            ├── App.tsx
            ├── Home.tsx
            ├── components/            # UI + feature components
            │   ├── Account.tsx
            │   ├── AlgoIntentChat.tsx
            │   ├── ConnectWallet.tsx
            │   ├── ErrorBoundary.tsx
            │   ├── SwapWidget.tsx
            │   ├── Transact.tsx
            │   └── WalletConnectButton.tsx
            ├── services/              # API/service layer
            │   ├── aiIntentService.ts
            │   ├── ipfsService.ts
            │   ├── tradingService.ts
            │   └── transactionService.ts
            ├── utils/
            │   ├── ellipseAddress.ts
            │   └── network/getAlgoClientConfigs.ts
            ├── interfaces/network.ts
            ├── styles/                # Tailwind + app styles
            │   ├── App.css
            │   └── tailwind.css
            ├── typings/
            │   └── tinyman-swap-widget-sdk.d.ts
            ├── main.tsx
            └── vite-env.d.ts
```

---

## 📝 Example Telegram Commands

Copy-paste or type these directly to the bot:

```
create me a new wallet

I want to connect my wallet

send 2 algos to this address K54ZTTHNDB567Q5J5T73CEJCT3Z3MB6VL35PJBIX57KGRWNGZZLH3BK7S4

Create 10 nfts with name Universe and give it description "This image shows our milky way"

send 2 algos to both K54ZTTHNDB567Q5J5T73CEJCT3Z3MB6VL35PJBIX57KGRWNGZZLH3BK7S4 and 6MZK4765UUZFBPAPXZBNXTIRHORJ75KBKRIGHVOB23OQODVMSB6GCL5DVM

Opt in for NFT 740574628

Opt out of NFT 740574628

Send NFT 740830836 to K54ZTTHNDB567Q5J5T73CEJCT3Z3MB6VL35PJBIX57KGRWNGZZLH3BK7S4

Disconnect my wallet
```

You can also send images or videos with captions like
`Create NFT named "Sunset" with description "Evening view"`
to mint NFTs with media.

---

## 📦 Setup

### 1) Clone the repository

```
git clone https://github.com/caerlower/algo-intent.git
cd algo-intent
```

### 2) Telegram Bot (Python)

- Install dependencies:
```
cd telegram_bot
pip install -r requirements.txt
```

- Create a `.env` file in `telegram_bot/` with:
  - `TELEGRAM_BOT_TOKEN` (from @BotFather)
  - `ALGOD_ADDRESS`, `ALGOD_TOKEN` (Algorand node)
  - `PINATA_API_KEY`, `PINATA_API_SECRET` (for IPFS uploads)
  - `PERPLEXITY_API_KEY` (for AI intent parsing)

- Run the bot:
```
python telegram_bot.py
```

### 3) Web App (Vite + React + TypeScript)

- Install Node dependencies:
```
cd algointent/projects/algointent
npm install
```

- Start the dev server:
```
npm run dev
```

- Common environment variables (if applicable; create `.env` or use Vite `import.meta.env`):
  - `VITE_ALGOD_ADDRESS`, `VITE_ALGOD_TOKEN`
  - `VITE_NETWORK` (e.g., `testnet` or `mainnet`)
  - Any API keys required by `aiIntentService.ts` or other services

---

## 🧩 Web App Highlights

- `AlgoIntentChat.tsx`: Conversational UI for intent input.
- `ConnectWallet.tsx` and `WalletConnectButton.tsx`: Wallet connection flow.
- `SwapWidget.tsx`: Integrated swap/trading widget.
- `transactionService.ts` and `tradingService.ts`: Encapsulated Algorand and trading logic.
- `ErrorBoundary.tsx`: Improved resilience.
- Tailwind-based styling with `styles/tailwind.css` and `tailwind.config.js`.

---

## 🔒 Security

- Sensitive data is never logged or persisted. Telegram bot deletes passwords/mnemonics after use.
- Wallet operations require explicit user consent (bot); the web app leverages the user’s wallet provider for approvals.
- Rate limiting and session management protect against abuse.

---

## 🛡️ Troubleshooting & Tips

- **Transaction appears failed but succeeded?** Always verify TxID in `https://testnet.explorer.perawallet.app`.
- **NFT/ALGO not received?** Ensure the recipient has opted-in (NFTs) and verify balances/history.
- **Bot misinterprets a command?** Rephrase or try the example commands.
- **Lost wallet access?** If you have your mnemonic, you can restore the wallet. The bot cannot recover lost mnemonics/passwords.

---

## 🌐 Supported Networks

| Network | Status  | Explorer Link                           |
|---------|---------|-----------------------------------------|
| Testnet | ✅ Live | `https://testnet.explorer.perawallet.app` |
| Mainnet | ⚠️ Beta | `https://explorer.perawallet.app/`        |

---

## 🤝 Contributing

Pull requests, issues, and feature suggestions are welcome.

---

## 📜 License

MIT License — see `LICENSE` for details.

---

## 🙋 FAQ

- **Can I use this on mainnet?** Yes. Point `ALGOD_ADDRESS` to a mainnet node and fund your wallet.
- **Is my mnemonic/password safe?** Yes. They’re never stored or logged; bot deletes sensitive data ASAP.
- **How does the system understand my commands?** AI intent parsing extracts actions and parameters from plain English.

---

## 🏁 Demo

YouTube: `https://youtu.be/gwnjztTM3wI`

---

Thank you for using Algo-Intent!

Build For Hack Series 2025