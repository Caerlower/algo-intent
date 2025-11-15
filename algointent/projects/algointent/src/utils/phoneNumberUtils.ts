/**
 * Phone Number Utilities
 * 
 * Validates and normalizes phone numbers for Hashi wallet integration
 */

/**
 * Validates if a string is a valid E.164 phone number
 * E.164 format: +[country code][number] (e.g., +1234567890, +15551234567)
 * 
 * Rules:
 * - Must start with +
 * - Country code: 1-3 digits
 * - Number: 7-15 digits (total including country code: 8-15 digits)
 * - Minimum total length: 8 digits (e.g., +12345678)
 * - Maximum total length: 15 digits (E.164 standard)
 * 
 * @param phoneNumber - Phone number string to validate
 * @returns True if valid E.164 format
 */
export function isValidPhoneNumber(phoneNumber: string): boolean {
  if (!phoneNumber || typeof phoneNumber !== 'string') {
    return false;
  }

  // Must start with +
  if (!phoneNumber.startsWith('+')) {
    return false;
  }

  // Remove + and check if remaining is all digits
  const digitsOnly = phoneNumber.slice(1).replace(/[^\d]/g, '');
  
  // E.164 rules:
  // - Minimum 8 digits total (including country code)
  // - Maximum 15 digits total
  // - Country code is 1-3 digits
  // - Number part is at least 7 digits
  
  if (digitsOnly.length < 8 || digitsOnly.length > 15) {
    return false;
  }

  // Check if it's all digits after removing non-digit characters
  const cleaned = phoneNumber.slice(1).replace(/[\s\-\(\)]/g, '');
  if (!/^\d+$/.test(cleaned)) {
    return false;
  }

  // Ensure cleaned version meets length requirements
  if (cleaned.length < 8 || cleaned.length > 15) {
    return false;
  }

  return true;
}

/**
 * Normalizes phone number to E.164 format
 * 
 * @param phoneNumber - Phone number in various formats
 * @returns Normalized E.164 phone number or null if invalid
 */
export function normalizePhoneNumber(phoneNumber: string): string | null {
  if (!phoneNumber || typeof phoneNumber !== 'string') {
    return null;
  }

  // Remove all whitespace and formatting characters, keep only digits
  let cleaned = phoneNumber.trim();
  
  // Extract the + if present
  const hasPlus = cleaned.startsWith('+');
  
  // Remove all non-digit characters
  const digitsOnly = cleaned.replace(/[^\d]/g, '');
  
  // Reconstruct with + prefix (always add +)
  cleaned = '+' + digitsOnly;

  // Validate the normalized number
  if (!isValidPhoneNumber(cleaned)) {
    return null;
  }

  return cleaned;
}

/**
 * Checks if a string is a phone number (starts with +) vs an Algorand address
 * 
 * @param recipient - Recipient string (could be address or phone number)
 * @returns True if it looks like a phone number
 */
export function isPhoneNumber(recipient: string): boolean {
  if (!recipient || typeof recipient !== 'string') {
    return false;
  }
  
  return recipient.trim().startsWith('+');
}

/**
 * Validates that a phone number is not too short (prevents 8-digit numbers from being accepted)
 * This ensures only proper international phone numbers are used
 * 
 * @param phoneNumber - Phone number to validate
 * @returns True if phone number is valid and not suspiciously short
 */
export function isValidPhoneNumberStrict(phoneNumber: string): boolean {
  if (!isValidPhoneNumber(phoneNumber)) {
    return false;
  }

  // Remove + and get digit count
  const digitsOnly = phoneNumber.slice(1).replace(/[^\d]/g, '');
  
  // Reject numbers that are exactly 8 digits (likely a mistake or local number)
  // Most proper international numbers are 10-15 digits
  // Allow minimum 9 digits to ensure it's a proper international number
  if (digitsOnly.length < 9) {
    return false;
  }

  return true;
}

