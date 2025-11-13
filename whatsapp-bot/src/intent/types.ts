/**
 * Intent parameter types
 */
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
  media_id?: string;
  media_type?: string;
  // Trading parameters
  from_asset?: string;
  to_asset?: string;
  price?: number;
  condition?: string;
  trigger_price?: number;
  trade_type?: 'market' | 'limit' | 'stop_loss' | 'take_profit';
  dex?: string;
}

/**
 * Parsed intent result from AI engine
 */
export interface ParsedIntent {
  intent: string;
  parameters: IntentParameters;
  context?: string;
  explanation?: string;
}

