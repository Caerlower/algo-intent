/**
 * WhatsApp Sender Service
 * 
 * Sends messages back to users via WhatsApp Cloud API
 */

import axios from 'axios';
import dotenv from 'dotenv';

dotenv.config();

function normalizePhoneNumber(to: string): string {
  let formattedPhone = to.replace(/[^\d+]/g, '');

  if (!formattedPhone.startsWith('+')) {
    formattedPhone = '+' + formattedPhone;
  }

  return formattedPhone.replace(/^\+/, '');
}

async function postWhatsAppMessage(payload: any) {
  const accessToken = process.env.WHATSAPP_ACCESS_TOKEN;
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;

  if (!accessToken || !phoneNumberId) {
    throw new Error('WhatsApp credentials not configured');
  }

  const url = `https://graph.facebook.com/v18.0/${phoneNumberId}/messages`;

  return axios.post(url, payload, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
  });
}

/**
 * Send WhatsApp message
 *
 * @param to - Recipient phone number (with country code, e.g., +919350105090)
 * @param message - Message text to send
 * @returns Success status
 */
export async function sendWhatsAppMessage(
  to: string,
  message: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const formattedPhone = normalizePhoneNumber(to);

    await postWhatsAppMessage({
      messaging_product: 'whatsapp',
      to: formattedPhone,
      type: 'text',
      text: {
        body: message,
      },
    });

    const phoneDisplay =
      formattedPhone.length > 4
        ? `${formattedPhone.slice(0, -4)}${'*'.repeat(4)}`
        : formattedPhone;
    console.log(`✅ WhatsApp message sent to ${phoneDisplay}`);
    return { success: true };
  } catch (error: any) {
    console.error('❌ Error sending WhatsApp message:', error.response?.data || error.message);
    return {
      success: false,
      error: error.response?.data?.error?.message || error.message || 'Unknown error',
    };
  }
}

interface QuickReplyButton {
  id: string;
  title: string;
}

/**
 * Send WhatsApp interactive message with quick reply buttons.
 */
export async function sendWhatsAppQuickReplies(
  to: string,
  body: string,
  buttons: QuickReplyButton[]
): Promise<{ success: boolean; error?: string }> {
  try {
    if (!Array.isArray(buttons) || buttons.length === 0) {
      throw new Error('Buttons array must contain at least one button');
    }

    const formattedPhone = normalizePhoneNumber(to);

    await postWhatsAppMessage({
      messaging_product: 'whatsapp',
      to: formattedPhone,
      type: 'interactive',
      interactive: {
        type: 'button',
        body: {
          text: body,
        },
        action: {
          buttons: buttons.slice(0, 3).map((button) => ({
            type: 'reply',
            reply: {
              id: button.id,
              title: button.title,
            },
          })),
        },
      },
    });

    const phoneDisplay =
      formattedPhone.length > 4
        ? `${formattedPhone.slice(0, -4)}${'*'.repeat(4)}`
        : formattedPhone;
    console.log(`✅ WhatsApp interactive message sent to ${phoneDisplay}`);
    return { success: true };
  } catch (error: any) {
    console.error('❌ Error sending WhatsApp interactive message:', error.response?.data || error.message);
    return {
      success: false,
      error: error.response?.data?.error?.message || error.message || 'Unknown error',
    };
  }
}
