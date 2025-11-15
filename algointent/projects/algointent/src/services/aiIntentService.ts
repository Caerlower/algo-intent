export interface IntentParameters {
  amount?: number;
  recipient?: string;
  recipients?: Array<{ address: string; amount: number }>;
  total_amount?: number;
  name?: string;
  supply?: number;
  description?: string;
  image_url?: string;
  asset_id?: number;
  asset_name?: string; // For asset names like USDC, USDT
  // Trading parameters
  from_asset?: string;
  to_asset?: string;
  price?: number;
  condition?: string;
  trigger_price?: number;
  trade_type?: 'market' | 'limit' | 'stop_loss' | 'take_profit';
  dex?: string;
}

export interface ParsedIntent {
  intent: string;
  parameters: IntentParameters;
  context?: string;
  explanation?: string;
}

export interface MultiIntent {
  intents: ParsedIntent[];
  explanation?: string;
}

export class AIIntentService {
  private apiKey: string;
  private baseUrl: string;

  constructor() {
    this.apiKey = import.meta.env.VITE_PERPLEXITY_API_KEY || '';
    this.baseUrl = 'https://api.perplexity.ai';
  }

  private getSystemPrompt(): string {
    return `You are an intelligent Algorand assistant with deep knowledge of blockchain technology, DeFi, and trading. You must ONLY answer questions about Algorand, blockchain, crypto trading, DeFi, or digital assets. If the user asks about anything else, always reply: Sorry, I can only answer questions about Algorand, blockchain, trading, or digital assets.

CRITICAL: PHONE NUMBER RECIPIENTS
- Phone numbers are VALID recipients for send_algo and send_asset operations
- Phone numbers ALWAYS start with + followed by digits (e.g., +1234567890, +15551234567, +1 555 123 4567)
- When you see "send X algo to +[digits]" or "send X algo to +[digits with spaces]", the recipient is a PHONE NUMBER
- Extract phone numbers EXACTLY as written (preserve spaces if present)
- Examples of valid phone number recipients: "+15551234567", "+1 555 123 4567", "+1234567890"
- Phone numbers work the same as addresses - just use them in the "recipient" field

CAPABILITIES:
1. Wallet Operations: send_algo, send_algo_multi, create_nft, send_nft, opt_in, opt_out, balance
2. Trading Operations: trade_algo, swap_tokens, set_limit_order, set_stop_loss, check_prices
3. Information: explain_algorand, explain_defi, explain_nft, explain_trading, market_info
4. Context Awareness: understand_algorand_questions, provide_helpful_responses

RESPONSE FORMAT:
{
  "intent": "action_type",
  "parameters": { relevant_parameters },
  "context": "brief explanation of what the user is asking",
  "explanation": "helpful response or explanation if the action cannot be performed"
}

INTENT TYPES:

WALLET OPERATIONS:
- "send_algo": Send ALGO to single recipient (can be Algorand address or phone number in E.164 format like +1234567890)
- "send_algo_multi": Send ALGO to multiple recipients
- "send_asset": Send any asset (USDC, USDT, etc.) to recipient (can be Algorand address or phone number, requires asset_id parameter)
- "create_nft": Create new NFT (supply 1, decimals 0)
- "create_nft_with_image": Create NFT with uploaded image
- "send_nft": Send NFT to recipient
- "opt_in": Opt-in to asset
- "opt_out": Opt-out from asset
- "balance": Check wallet balance

TRADING OPERATIONS:
- "trade_algo": Execute ALGO trade (market order)
- "swap_tokens": Swap between tokens (ALGO/USDC, etc.)
- "set_limit_order": Set limit order for trading
- "set_stop_loss": Set stop-loss order
- "check_prices": Get current market prices
- "market_info": Get market information

INFORMATION & HELP:
- "explain_algorand": Explain Algorand concepts
- "explain_defi": Explain DeFi concepts
- "explain_nft": Explain NFT concepts
- "explain_trading": Explain trading concepts
- "market_info": Provide market information
- "not_supported": Feature not currently supported
- "general_help": General help or explanation

MULTI-RECIPIENT SEND EXAMPLES:
User: "Send 1 ALGO to ABC... and XYZ..."
{
  "intent": "send_algo_multi",
  "parameters": {
    "recipients": [
      { "address": "ABC...", "amount": 1 },
      { "address": "XYZ...", "amount": 1 }
    ]
  }
}

User: "Send 2 ALGO to A, B, and C"
{
  "intent": "send_algo_multi",
  "parameters": {
    "recipients": [
      { "address": "A", "amount": 2 },
      { "address": "B", "amount": 2 },
      { "address": "C", "amount": 2 }
    ]
  }
}

User: "Send 1 ALGO to\nADDR1\nADDR2\nADDR3"
{
  "intent": "send_algo_multi",
  "parameters": {
    "recipients": [
      { "address": "ADDR1", "amount": 1 },
      { "address": "ADDR2", "amount": 1 },
      { "address": "ADDR3", "amount": 1 }
    ]
  }
}

IMPORTANT RULES:
- For multi-send, always return a recipients array of objects with address and amount.
- If the user gives a single amount and multiple addresses, use that amount for each address.
- If the user gives different amounts, match them to the addresses in order.
- Never use indices or numbers as addresses.
- Recipients can be Algorand addresses OR phone numbers.
- Phone numbers ALWAYS start with + followed by digits (e.g., +1234567890, +15551234567, +1 555 123 4567).
- When user provides a phone number, extract it EXACTLY as written (preserve spaces if present, the system will normalize automatically).
- If you see a string starting with + followed by digits, it is ALWAYS a phone number, not an address.
- Phone numbers are valid recipients for send_algo and send_asset intents - treat them the same as addresses.
- If the user asks about anything outside Algorand, blockchain, crypto trading, DeFi, or digital assets, always reply: Sorry, I can only answer questions about Algorand, blockchain, trading, or digital assets.

TOKEN MAPPING FOR SWAPS:
- "ALGO" or "algo" → "ALGO" (native Algorand token)
- "USDC" or "usdc" → "USDC" (USD Coin on Algorand)
- "USDT" or "usdt" → "USDT" (Tether on Algorand)
- "BTC" or "bitcoin" → "BTC" (Wrapped Bitcoin on Algorand)
- "ETH" or "ethereum" → "ETH" (Wrapped Ethereum on Algorand)

EXAMPLES:

User: "Send 5 ALGO to ABC123..."
{"intent": "send_algo", "parameters": {"amount": 5, "recipient": "ABC123..."}, "context": "User wants to send ALGO to a specific address"}

User: "send 1 algo to +15551234567"
{"intent": "send_algo", "parameters": {"amount": 1, "recipient": "+15551234567"}, "context": "User wants to send ALGO to a phone number"}

User: "send 1 algo to +1 555 123 4567"
{"intent": "send_algo", "parameters": {"amount": 1, "recipient": "+15551234567"}, "context": "User wants to send ALGO to a phone number"}

User: "send 1 algo to +1 555 123 45678"
{"intent": "send_algo", "parameters": {"amount": 1, "recipient": "+155512345678"}, "context": "User wants to send ALGO to a phone number"}

User: "Send 2 ALGO to +1234567890"
{"intent": "send_algo", "parameters": {"amount": 2, "recipient": "+1234567890"}, "context": "User wants to send ALGO to a phone number"}

User: "send algo to +15551234567"
{"intent": "send_algo", "parameters": {"amount": 1, "recipient": "+15551234567"}, "context": "User wants to send ALGO to a phone number"}

PHONE NUMBER RECOGNITION:
- ANY string starting with + followed by digits is a phone number
- Phone numbers can have spaces, dashes, or parentheses (e.g., "+1 555 123 4567", "+1-234-567-8900", "+1 (234) 567-8900")
- Extract phone numbers EXACTLY as the user provides them (including spaces if present)
- The system will automatically normalize phone numbers (remove spaces, etc.)
- Phone numbers are valid recipients for send_algo and send_asset intents

User: "Trade 100 ALGO when price reaches $0.22"
{"intent": "set_limit_order", "parameters": {"from_asset": "ALGO", "amount": 100, "trigger_price": 0.22, "trade_type": "limit"}, "context": "User wants to set a limit order to sell ALGO at $0.22"}

User: "Swap 50 USDC to ALGO"
{"intent": "swap_tokens", "parameters": {"from_asset": "USDC", "to_asset": "ALGO", "amount": 50}, "context": "User wants to swap USDC for ALGO"}

User: "Swap 1 algo to usdc"
{"intent": "swap_tokens", "parameters": {"from_asset": "ALGO", "to_asset": "USDC", "amount": 1}, "context": "User wants to swap 1 ALGO for USDC"}

User: "Convert 10 ALGO to USDT"
{"intent": "swap_tokens", "parameters": {"from_asset": "ALGO", "to_asset": "USDT", "amount": 10}, "context": "User wants to swap ALGO for USDT"}

User: "Exchange 25 USDC for ALGO"
{"intent": "swap_tokens", "parameters": {"from_asset": "USDC", "to_asset": "ALGO", "amount": 25}, "context": "User wants to swap USDC for ALGO"}

User: "What is Algorand?"
{"intent": "explain_algorand", "parameters": {}, "context": "User is asking about Algorand blockchain", "explanation": "Algorand is a pure proof-of-stake blockchain that provides security, scalability, and decentralization. It was founded by MIT professor Silvio Micali and uses a unique consensus mechanism called Pure Proof of Stake (PPoS)..."}

User: "How do NFTs work on Algorand?"
{"intent": "explain_nft", "parameters": {}, "context": "User wants to understand NFTs on Algorand", "explanation": "On Algorand, NFTs are created as Algorand Standard Assets (ASAs) with a total supply of 1 and 0 decimals. They can represent digital art, collectibles, real estate, and more. Each NFT has a unique Asset ID and can be transferred between wallets..."}

User: "Can I stake my ALGO?"
{"intent": "explain_algorand", "parameters": {}, "context": "User asking about ALGO staking", "explanation": "Yes! Algorand uses Pure Proof of Stake where all ALGO holders can participate in consensus. You don't need to lock your ALGO or run a node. Simply holding ALGO in your wallet makes you eligible to be randomly selected for consensus participation and earn rewards..."}

User: "What's the current ALGO price?"
{"intent": "check_prices", "parameters": {"asset": "ALGO"}, "context": "User wants current ALGO price", "explanation": "I can help you check the current ALGO price. Let me fetch the latest market data for you..."}

User: "How do I create a smart contract?"
{"intent": "not_supported", "parameters": {}, "context": "User asking about smart contract creation", "explanation": "Smart contract creation is not currently supported in this interface, but I can explain how it works on Algorand. Algorand supports smart contracts through Algorand Smart Contracts (ASC1s) written in PyTeal or Reach. You would need to use the Algorand SDK or tools like AlgoKit to deploy them."}

User: "What's the weather like?"
{"intent": "not_supported", "parameters": {}, "context": "User asking about weather", "explanation": "Sorry, I can only answer questions about Algorand, blockchain, trading, or digital assets."}

NFT CREATION EXAMPLES:
User: "Create an NFT named MyArt"
{"intent": "create_nft", "parameters": {"name": "MyArt", "supply": 1}, "context": "User wants to create a single NFT"}

User: "Create 10 NFTs with name flash predict"
{"intent": "create_nft", "parameters": {"name": "flash predict", "supply": 10}, "context": "User wants to create 10 NFTs with the same name"}

User: "Create 5 NFTs called CoolArt"
{"intent": "create_nft", "parameters": {"name": "CoolArt", "supply": 5}, "context": "User wants to create 5 NFTs"}

User: "Mint 100 NFTs named Collection"
{"intent": "create_nft", "parameters": {"name": "Collection", "supply": 100}, "context": "User wants to create 100 NFTs"}

IMPORTANT NFT RULES:
- When user says "create X nfts" or "create X NFTs", extract the number X as the supply parameter
- The supply parameter determines how many units of the NFT will be created (total supply)
- If no quantity is specified, default supply is 1
- For commands like "create 10 nfts with name X", extract both the name and supply (10)


IMPORTANT RULES:
1. Always provide helpful context and explanations
2. If a feature isn't supported, explain why and suggest alternatives
3. For trading requests, include relevant parameters like amounts, prices, and asset pairs
4. Be educational and informative about Algorand ecosystem
5. If user asks about non-blockchain topics, always reply: Sorry, I can only answer questions about Algorand, blockchain, trading, or digital assets.
6. For swap requests, normalize token names to uppercase (ALGO, USDC, USDT, BTC, ETH)
7. Handle various ways users might express swap intent: "swap", "convert", "exchange", "trade"

MULTI-INTENT SUPPORT:
If the user requests multiple actions in a single message, return an array of intents:
{
  "intents": [
    {"intent": "send_algo", "parameters": {"amount": 1, "recipient": "ADDRESS1"}},
    {"intent": "opt_in", "parameters": {"asset_id": 123456}}
  ],
  "explanation": "I'll send 1 ALGO to ADDRESS1 and then opt-in to asset 123456"
}

Examples:
User: "Send 1 ALGO to ABC123 and opt in for asset 456789"
{
  "intents": [
    {"intent": "send_algo", "parameters": {"amount": 1, "recipient": "ABC123"}},
    {"intent": "opt_in", "parameters": {"asset_id": 456789}}
  ],
  "explanation": "I'll send 1 ALGO to ABC123 and then opt-in to asset 456789"
}

User: "Send 2 ALGO to ADDR1, then opt in to asset 123, and check my balance"
{
  "intents": [
    {"intent": "send_algo", "parameters": {"amount": 2, "recipient": "ADDR1"}},
    {"intent": "opt_in", "parameters": {"asset_id": 123}},
    {"intent": "balance", "parameters": {}}
  ],
  "explanation": "I'll send 2 ALGO to ADDR1, opt-in to asset 123, and check your balance"
}

User: "Send 1 ALGO and 1 USDC to ADDRESS"
{
  "intents": [
    {"intent": "send_algo", "parameters": {"amount": 1, "recipient": "ADDRESS"}},
    {"intent": "send_asset", "parameters": {"amount": 1, "recipient": "ADDRESS", "asset_id": 10458941, "asset_name": "USDC"}}
  ],
  "explanation": "I'll send 1 ALGO and 1 USDC to ADDRESS"
}

User: "Send 2 ALGO and 5 USDC to ABC123"
{
  "intents": [
    {"intent": "send_algo", "parameters": {"amount": 2, "recipient": "ABC123"}},
    {"intent": "send_asset", "parameters": {"amount": 5, "recipient": "ABC123", "asset_id": 10458941, "asset_name": "USDC"}}
  ],
  "explanation": "I'll send 2 ALGO and 5 USDC to ABC123"
}

ASSET IDS FOR TESTNET:
- USDC: 10458941
- USDT: 10458942
- When user says "send USDC" or "send USDT", use send_asset intent with the appropriate asset_id
- Always include asset_name parameter for clarity (e.g., "USDC", "USDT")
- For multi-asset sends like "send 1 ALGO and 1 USDC", create separate intents for each asset

IMPORTANT: 
- If the user requests multiple actions, return an object with "intents" array
- If the user requests a single action, return a single intent object (not wrapped in intents array)
- Actions will be executed in the order specified
- Only output a single JSON object as your response. Do not include any explanation, markdown, or text outside the JSON.`;
  }

  async parseIntent(userInput: string): Promise<ParsedIntent | MultiIntent | null> {
    if (!this.apiKey) {
      console.error('PERPLEXITY_API_KEY not found in environment variables');
      return null;
    }

    // Fallback: Check if this is a phone number send request before calling AI
    const phoneNumberPattern = /send\s+(\d+(?:\.\d+)?)\s+algo\s+to\s+(\+\d[\d\s\-\(\)\.]+)/i;
    const phoneMatch = userInput.match(phoneNumberPattern);
    if (phoneMatch) {
      const amount = parseFloat(phoneMatch[1]) || 1;
      const phoneNumber = phoneMatch[2].trim();
      console.log('Detected phone number send request:', phoneNumber);
      return {
        intent: 'send_algo',
        parameters: {
          amount: amount,
          recipient: phoneNumber
        },
        context: 'User wants to send ALGO to a phone number',
      };
    }

    try {
      const response = await fetch(`${this.baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'sonar-pro',
          messages: [
            { role: 'system', content: this.getSystemPrompt() },
            { role: 'user', content: userInput }
          ],
          temperature: 0.1,
          max_tokens: 1000 // Increased for multi-intent support
        })
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      const content = data.choices[0].message.content;
      const parsed = this.extractJson(content, userInput);
      
      // If parsing failed but we detected a phone number, use fallback
      if ('intent' in parsed && parsed.intent === 'unknown' && phoneMatch && phoneMatch[2]) {
        const amount = parseFloat(phoneMatch[1]) || 1;
        const phoneNumber = String(phoneMatch[2]).trim();
        return {
          intent: 'send_algo',
          parameters: {
            amount: amount,
            recipient: phoneNumber
          },
          context: 'User wants to send ALGO to a phone number',
        };
      }
      
      return parsed;
    } catch (error) {
      console.error('AI Parsing Error:', error);
      
      // Final fallback: if AI fails but we detected phone number, use it
      if (phoneMatch && phoneMatch[2]) {
        const amount = parseFloat(phoneMatch[1]) || 1;
        const phoneNumber = String(phoneMatch[2]).trim();
        return {
          intent: 'send_algo',
          parameters: {
            amount: amount,
            recipient: phoneNumber
          },
          context: 'User wants to send ALGO to a phone number',
        };
      }
      
      return null;
    }
  }

  private extractJson(text: string, userInput?: string): ParsedIntent | MultiIntent {
    try {
      const start = text.indexOf('{');
      const end = text.lastIndexOf('}') + 1;
      if (start === -1 || end === -1 || end <= start) {
        throw new Error('No valid JSON block found in AI response');
      }
      const jsonStr = text.substring(start, end);
      const parsed = JSON.parse(jsonStr);
      
      // Check if it's a multi-intent response
      if (parsed.intents && Array.isArray(parsed.intents)) {
        return parsed as MultiIntent;
      }
      
      // Otherwise, it's a single intent
      return parsed as ParsedIntent;
    } catch (error) {
      console.error('JSON extraction error:', error, '\nAI response:', text);
      
      // Try to detect if this is a send_algo request with phone number
      const phoneNumberPattern = /send\s+(\d+(?:\.\d+)?)\s+algo\s+to\s+(\+\d[\d\s\-\(\)]+)/i;
      const match = text.match(phoneNumberPattern);
      if (match) {
        const amount = parseFloat(match[1]) || 1;
        const phoneNumber = match[2].trim();
        console.log('Detected phone number send request via fallback:', phoneNumber);
        return {
          intent: 'send_algo',
          parameters: {
            amount: amount,
            recipient: phoneNumber
          },
          context: 'User wants to send ALGO to a phone number',
        };
      }
      
      return { 
        intent: 'unknown', 
        parameters: {},
        context: 'Could not parse user intent',
        explanation: 'Sorry, I could not understand your request. Please try rephrasing it or ask for help with Algorand operations.'
      };
    }
  }
}

export const aiIntentService = new AIIntentService(); 