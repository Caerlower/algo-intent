/**
 * WhatsApp Sender Service
 * 
 * Sends messages back to users via WhatsApp Cloud API
 */

import axios from 'axios';
import dotenv from 'dotenv';

dotenv.config();

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
    const accessToken = process.env.WHATSAPP_ACCESS_TOKEN;
    const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;

    if (!accessToken || !phoneNumberId) {
      throw new Error('WhatsApp credentials not configured');
    }

    // Format phone number (remove any non-digit characters except +)
    // Remove spaces, dashes, parentheses, etc.
    let formattedPhone = to.replace(/[^\d+]/g, '');
    
    // Ensure phone number starts with + if it doesn't
    if (!formattedPhone.startsWith('+')) {
      formattedPhone = '+' + formattedPhone;
    }
    
    // Remove leading + if present (WhatsApp API expects just digits with country code)
    // Actually, WhatsApp API requires the + to be removed, only digits
    formattedPhone = formattedPhone.replace(/^\+/, '');

    const url = `https://graph.facebook.com/v18.0/${phoneNumberId}/messages`;

    const response = await axios.post(
      url,
      {
        messaging_product: 'whatsapp',
        to: formattedPhone,
        type: 'text',
        text: {
          body: message,
        },
      },
      {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
      }
    );

    const phoneDisplay = formattedPhone.length > 4 
      ? `${formattedPhone.slice(0, -4)}${'*'.repeat(4)}` 
      : formattedPhone;
    console.log(`✅ WhatsApp message sent to ${phoneDisplay}`);
    return { success: true };
  } catch (error: any) {
    console.error('❌ Error sending WhatsApp message:', error.response?.data || error.message);
    return {
      success: false,
      error: error.response?.data?.error?.message || error.message || 'Unknown error'
    };
  }
}

