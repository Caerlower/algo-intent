/**
 * Type definitions for WhatsApp Cloud API webhook payloads
 */

/**
 * WhatsApp message entry structure from Meta webhook
 */
export interface WhatsAppEntry {
  id: string;
  changes: WhatsAppChange[];
}

/**
 * Change object containing message data
 */
export interface WhatsAppChange {
  value: WhatsAppValue;
  field: string;
}

/**
 * Value object containing messages and metadata
 */
export interface WhatsAppValue {
  messaging_product: string;
  metadata: {
    display_phone_number: string;
    phone_number_id: string;
  };
  contacts?: WhatsAppContact[];
  messages?: WhatsAppMessage[];
  statuses?: WhatsAppStatus[];
}

/**
 * WhatsApp contact information
 */
export interface WhatsAppContact {
  profile: {
    name: string;
  };
  wa_id: string; // Phone number in E.164 format
}

/**
 * WhatsApp message structure
 */
export interface WhatsAppMessage {
  from: string; // Phone number in E.164 format
  id: string; // Message ID
  timestamp: string; // Unix timestamp
  type: 'text' | 'image' | 'video' | 'audio' | 'document' | 'location' | 'contacts';
  text?: {
    body: string;
  };
  image?: {
    id: string;
    mime_type: string;
    sha256: string;
    caption?: string;
  };
  video?: {
    id: string;
    mime_type: string;
    sha256: string;
    caption?: string;
  };
  audio?: {
    id: string;
    mime_type: string;
  };
  document?: {
    id: string;
    mime_type: string;
    filename?: string;
    caption?: string;
  };
  location?: {
    longitude: number;
    latitude: number;
    name?: string;
    address?: string;
  };
  context?: {
    from: string;
    id: string;
    referred_product?: {
      catalog_id: string;
      product_retailer_id: string;
    };
  };
}

/**
 * WhatsApp status updates
 */
export interface WhatsAppStatus {
  id: string;
  status: 'sent' | 'delivered' | 'read' | 'failed';
  timestamp: string;
  recipient_id: string;
  errors?: Array<{
    code: number;
    title: string;
    message: string;
    error_data?: {
      details: string;
    };
  }>;
}

/**
 * Extracted message data for processing
 */
export interface ExtractedMessage {
  phoneNumber: string; // Phone number in E.164 format (e.g., +919876543210)
  messageText: string | null; // Text content, null if media message
  messageId: string;
  timestamp: string;
  messageType: WhatsAppMessage['type'];
  mediaId?: string; // For media messages
  mediaType?: string; // MIME type for media
  caption?: string; // Caption for media messages
}

/**
 * Webhook verification query parameters
 */
export interface WebhookVerificationQuery {
  'hub.mode': string;
  'hub.verify_token': string;
  'hub.challenge': string;
}

