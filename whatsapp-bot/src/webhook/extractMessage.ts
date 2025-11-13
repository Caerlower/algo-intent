/**
 * Utility functions for safely extracting message data from WhatsApp webhook payloads
 */

import { WhatsAppEntry, ExtractedMessage } from '../types/whatsapp';

/**
 * Safely extracts message information from WhatsApp webhook payload
 * 
 * @param body - Raw webhook payload from Meta
 * @returns Extracted message data or null if no valid message found
 */
export function extractMessage(body: any): ExtractedMessage | null {
  try {
    // Validate body structure
    if (!body || !body.entry || !Array.isArray(body.entry) || body.entry.length === 0) {
      return null;
    }

    const entry: WhatsAppEntry = body.entry[0];

    // Check if entry has changes
    if (!entry.changes || !Array.isArray(entry.changes) || entry.changes.length === 0) {
      return null;
    }

    const change = entry.changes[0];

    // Check if change has value with messages
    if (!change.value || !change.value.messages || !Array.isArray(change.value.messages)) {
      return null;
    }

    const message = change.value.messages[0];

    // Validate message structure
    if (!message || !message.from || !message.id) {
      return null;
    }

    // Extract phone number (ensure it starts with +)
    const phoneNumber = message.from.startsWith('+') ? message.from : `+${message.from}`;

    // Extract message text based on type
    let messageText: string | null = null;
    let mediaId: string | undefined;
    let mediaType: string | undefined;
    let caption: string | undefined;

    if (message.type === 'text' && message.text) {
      messageText = message.text.body || null;
    } else if (message.image) {
      messageText = message.image.caption || null;
      mediaId = message.image.id;
      mediaType = message.image.mime_type;
      caption = message.image.caption;
    } else if (message.video) {
      messageText = message.video.caption || null;
      mediaId = message.video.id;
      mediaType = message.video.mime_type;
      caption = message.video.caption;
    } else if (message.audio) {
      mediaId = message.audio.id;
      mediaType = message.audio.mime_type;
    } else if (message.document) {
      messageText = message.document.caption || null;
      mediaId = message.document.id;
      mediaType = message.document.mime_type;
      caption = message.document.caption;
    } else if (message.type === 'interactive' && message.interactive) {
      if (message.interactive.button_reply) {
        const buttonReply = message.interactive.button_reply;
        messageText = buttonReply.payload || buttonReply.title || null;
        caption = buttonReply.title;
        mediaId = buttonReply.id;
      } else if (message.interactive.list_reply) {
        const listReply = message.interactive.list_reply;
        messageText = listReply.description || listReply.title || null;
        caption = listReply.title;
        mediaId = listReply.id;
      }
    }

    return {
      phoneNumber,
      messageText,
      messageId: message.id,
      timestamp: message.timestamp,
      messageType: message.type,
      mediaId,
      mediaType,
      caption,
      buttonId: message.interactive?.button_reply?.id,
    };
  } catch (error) {
    console.error('Error extracting message:', error);
    return null;
  }
}

/**
 * Validates webhook payload structure
 * 
 * @param body - Raw webhook payload
 * @returns True if payload structure is valid
 */
export function isValidWebhookPayload(body: any): boolean {
  try {
    return (
      body &&
      body.entry &&
      Array.isArray(body.entry) &&
      body.entry.length > 0 &&
      body.entry[0].changes &&
      Array.isArray(body.entry[0].changes) &&
      body.entry[0].changes.length > 0
    );
  } catch {
    return false;
  }
}

