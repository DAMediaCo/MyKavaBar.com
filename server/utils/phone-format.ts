import { z } from "zod";

// Validation schema for phone numbers
export const phoneNumberSchema = z.string()
  .regex(/^\+1[2-9]\d{9}$/, 'Phone number must be a valid US number in E.164 format (+1XXXXXXXXXX)')
  .transform((val) => formatToE164(val));

export function isValidE164(phone: string): boolean {
  const e164Regex = /^\+1[2-9]\d{9}$/;
  return e164Regex.test(phone);
}

export function formatToE164(phone: string): string {
  try {
    console.log('Formatting phone number, input:', phone);

    // If already in E.164 format and valid, return as is
    if (isValidE164(phone)) {
      console.log('Phone already in E.164 format:', phone);
      return phone;
    }

    // Remove all non-numeric characters
    let cleaned = phone.replace(/\D/g, '');
    console.log('Cleaned phone number:', cleaned);

    // Handle various input formats
    if (cleaned.length === 11) {
      if (!cleaned.startsWith('1')) {
        throw new Error('11-digit numbers must start with 1');
      }
      cleaned = cleaned.substring(1);
      console.log('Removed leading 1:', cleaned);
    } else if (cleaned.length === 10) {
      // 10 digits is okay, continue
      console.log('10-digit number detected:', cleaned);
    } else {
      console.error('Invalid phone number length:', {
        original: phone,
        cleaned: cleaned,
        length: cleaned.length
      });
      throw new Error('Phone number must be 10 digits (or 11 with leading 1)');
    }

    // Ensure first digit is not 0 or 1 (US area codes start from 2)
    if (cleaned[0] === '0' || cleaned[0] === '1') {
      throw new Error('Invalid area code - must start with 2-9');
    }

    // Format to E.164 with +1 prefix
    const formatted = `+1${cleaned}`;
    console.log('Formatted to E.164:', formatted);

    // Final validation
    if (!isValidE164(formatted)) {
      console.error('Failed E.164 validation:', {
        original: phone,
        cleaned: cleaned,
        formatted: formatted,
        validationRegex: '/^\\+1[2-9]\\d{9}$/'
      });
      throw new Error('Failed to format phone number to valid E.164 format');
    }

    return formatted;
  } catch (error: any) {
    console.error('Phone formatting error:', {
      input: phone,
      error: error.message
    });
    throw error;
  }
}