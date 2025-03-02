import { formatToE164 } from './phone-format';
import { sendVerificationCode as sendCode, verifyCode as verify } from './prelude';

export async function sendVerificationCode(phoneNumber: string) {
  try {
    console.log('Phone verification: starting verification process for:', phoneNumber);

    // Format phone number for verification
    const formattedNumber = formatToE164(phoneNumber);
    console.log('Phone verification: formatted number:', formattedNumber);

    // Send verification using Prelude service
    const result = await sendCode(formattedNumber);
    console.log('Phone verification: send result:', result);

    return result;
  } catch (error) {
    console.error('Phone verification: error sending code:', error);
    return {
      success: false,
      error: 'Failed to send verification code',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    };
  }
}

export async function verifyCode(phoneNumber: string, code: string) {
  try {
    console.log('Phone verification: verifying code for phone:', phoneNumber);

    // Format phone number
    const formattedNumber = formatToE164(phoneNumber);

    // Verify using Prelude service
    const result = await verify(formattedNumber, code);
    console.log('Phone verification: verification result:', result);

    return result;
  } catch (error) {
    console.error('Phone verification: error verifying code:', error);
    return {
      success: false,
      error: 'Failed to verify code',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    };
  }
}