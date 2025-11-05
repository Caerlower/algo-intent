/**
 * AlgoIntent Engine - Natural Language Intent Parsing
 * 
 * Adapted from web app's aiIntentService.ts for Node.js
 * Uses Perplexity API to parse natural language into structured intents
 */

import dotenv from 'dotenv';
import { ParsedIntent, IntentParameters } from './types';

// Load environment variables
dotenv.config();

/**
 * Perplexity API Response Types
 */
interface PerplexityChoice {
  message: {
    content: string;
    role: string;
  };
  finish_reason?: string;
}

interface PerplexityResponse {
  choices: PerplexityChoice[];
  id?: string;
  model?: string;
  created?: number;
}

export class IntentEngine {
  private apiKey: string;
  private baseUrl: string;

  constructor() {
    this.apiKey = process.env.PERPLEXITY_API_KEY || '';
    this.baseUrl = 'https://api.perplexity.ai';
  }

  /**
   * Get system prompt for Perplexity API
   * Same prompt as web app for consistency
   */
  private getSystemPrompt(): string {
    return `You are an intelligent Algorand assistant with deep knowledge of blockchain technology, DeFi, and trading. You must ONLY answer questions about Algorand, blockchain, crypto trading, DeFi, or digital assets. If the user asks about anything else, always reply: Sorry, I can only answer questions about Algorand, blockchain, trading, or digital assets.

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
- "send_algo": Send ALGO to single recipient
- "send_algo_multi": Send ALGO to multiple recipients
- "create_nft": Create new NFT
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

User: "Send 1 ALGO to\\nADDR1\\nADDR2\\nADDR3"
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
- Only use valid Algorand addresses in the recipients array.
- If the user asks about anything outside Algorand, blockchain, crypto trading, DeFi, or digital assets, always reply: Sorry, I can only answer questions about Algorand, blockchain, trading, or digital assets.
- For WhatsApp, recipients can be phone numbers (e.g., +573001234567) OR Algorand addresses

TOKEN MAPPING FOR SWAPS:
- "ALGO" or "algo" → "ALGO" (native Algorand token)
- "USDC" or "usdc" → "USDC" (USD Coin on Algorand)
- "USDT" or "usdt" → "USDT" (Tether on Algorand)
- "BTC" or "bitcoin" → "BTC" (Wrapped Bitcoin on Algorand)
- "ETH" or "ethereum" → "ETH" (Wrapped Ethereum on Algorand)

EXAMPLES:

User: "Send 5 ALGO to ABC123..."
{"intent": "send_algo", "parameters": {"amount": 5, "recipient": "ABC123..."}, "context": "User wants to send ALGO to a specific address"}

User: "Send 2 ALGO to +573001234567"
{"intent": "send_algo", "parameters": {"amount": 2, "recipient": "+573001234567"}, "context": "User wants to send ALGO to a phone number"}

User: "Check my balance"
{"intent": "balance", "parameters": {}, "context": "User wants to check their wallet balance"}

User: "Opt-in to NFT 123456"
{"intent": "opt_in", "parameters": {"asset_id": 123456}, "context": "User wants to opt-in to an asset"}

User: "Opt out of asset 654321"
{"intent": "opt_out", "parameters": {"asset_id": 654321}, "context": "User wants to opt-out from an asset"}

User: "What is Algorand?"
{"intent": "explain_algorand", "parameters": {}, "context": "User is asking about Algorand blockchain", "explanation": "Algorand is a pure proof-of-stake blockchain that provides security, scalability, and decentralization. It was founded by MIT professor Silvio Micali and uses a unique consensus mechanism called Pure Proof of Stake (PPoS)..."}

User: "How do NFTs work on Algorand?"
{"intent": "explain_nft", "parameters": {}, "context": "User wants to understand NFTs on Algorand", "explanation": "On Algorand, NFTs are created as Algorand Standard Assets (ASAs) with a total supply of 1 and 0 decimals. They can represent digital art, collectibles, real estate, and more. Each NFT has a unique Asset ID and can be transferred between wallets..."}

User: "Can I stake my ALGO?"
{"intent": "explain_algorand", "parameters": {}, "context": "User asking about ALGO staking", "explanation": "Yes! Algorand uses Pure Proof of Stake where all ALGO holders can participate in consensus. You don't need to lock your ALGO or run a node. Simply holding ALGO in your wallet makes you eligible to be randomly selected for consensus participation and earn rewards..."}

User: "What's the current ALGO price?"
{"intent": "check_prices", "parameters": {"asset": "ALGO"}, "context": "User wants current ALGO price", "explanation": "I can help you check the current ALGO price. Let me fetch the latest market data for you..."}

User: "What's the weather like?"
{"intent": "not_supported", "parameters": {}, "context": "User asking about weather", "explanation": "Sorry, I can only answer questions about Algorand, blockchain, trading, or digital assets."}

IMPORTANT RULES:
1. Always provide helpful context and explanations
2. If a feature isn't supported, explain why and suggest alternatives
3. For trading requests, include relevant parameters like amounts, prices, and asset pairs
4. Be educational and informative about Algorand ecosystem
5. If user asks about non-blockchain topics, always reply: Sorry, I can only answer questions about Algorand, blockchain, trading, or digital assets.
6. For swap requests, normalize token names to uppercase (ALGO, USDC, USDT, BTC, ETH)
7. Handle various ways users might express swap intent: "swap", "convert", "exchange", "trade"
8. For WhatsApp, recipients can be phone numbers (starting with +) or Algorand addresses (58 characters)

IMPORTANT: Only output a single JSON object as your response. Do not include any explanation, markdown, or text outside the JSON.`;
  }

  /**
   * Parse user input and extract intent
   * 
   * @param userInput - Natural language message from user
   * @returns Parsed intent with parameters, or null if parsing fails
   */
  async parseIntent(userInput: string): Promise<ParsedIntent | null> {
    if (!this.apiKey) {
      console.error('❌ PERPLEXITY_API_KEY not found in environment variables');
      return null;
    }

    if (!userInput || !userInput.trim()) {
      console.warn('⚠️ Empty user input provided');
      return null;
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
            { role: 'user', content: userInput.trim() }
          ],
          temperature: 0.1,
          max_tokens: 500
        })
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`HTTP error! status: ${response.status}, body: ${errorText}`);
      }

      const data = await response.json() as PerplexityResponse;
      
      if (!data.choices || !Array.isArray(data.choices) || data.choices.length === 0) {
        throw new Error('Invalid API response: missing choices array');
      }

      const content = data.choices[0]?.message?.content;

      if (!content) {
        throw new Error('No content in API response');
      }

      return this.extractJson(content);
    } catch (error) {
      console.error('❌ AI Parsing Error:', error);
      return null;
    }
  }

  /**
   * Extract JSON from AI response text
   * Handles cases where AI returns JSON wrapped in markdown or text
   * 
   * @param text - Raw response text from AI
   * @returns Parsed intent object
   */
  private extractJson(text: string): ParsedIntent {
    try {
      const start = text.indexOf('{');
      const end = text.lastIndexOf('}') + 1;
      
      if (start === -1 || end === -1 || end <= start) {
        throw new Error('No valid JSON block found in AI response');
      }
      
      const jsonStr = text.substring(start, end);
      const parsed = JSON.parse(jsonStr);
      
      // Validate parsed result has required fields
      if (!parsed.intent) {
        throw new Error('Parsed intent missing required "intent" field');
      }
      
      return parsed as ParsedIntent;
    } catch (error) {
      console.error('❌ JSON extraction error:', error);
      console.error('📋 AI response:', text);
      return { 
        intent: 'unknown', 
        parameters: {},
        context: 'Could not parse user intent',
        explanation: 'Sorry, I could not understand your request. Please try rephrasing it or ask for help with Algorand operations.'
      };
    }
  }
}

// Export singleton instance
export const intentEngine = new IntentEngine();

