import { formatToE164 } from './phone-format';
import { sendVerificationCode as sendCode, verifyCode as verify } from './prelude';

function getErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (typeof error === 'string') return error;
  return 'Unknown error';
}

export async function sendVerificationCode(phoneNumber: string) {
  try {
    console.log('Phone verification: starting verification process for:', phoneNumber);
    const formattedNumber = formatToE164(phoneNumber);
    console.log('Phone verification: formatted number:', formattedNumber);
    const result = await sendCode(formattedNumber);
    console.log('Phone verification: send result:', result);
    return result;
  } catch (error) {
    console.error('Phone verification: error sending code:', error);
    return {
      success: false,
      error: 'Failed to send verification code',
      details: process.env.NODE_ENV === 'development' ? getErrorMessage(error) : undefined,
    };
  }
}

export async function verifyCode(phoneNumber: string, code: string) {
  try {
    console.log('Phone verification: verifying code for phone:', phoneNumber);
    const formattedNumber = formatToE164(phoneNumber);
    const result = await verify(formattedNumber, code);
    console.log('Phone verification: verification result:', result);
    return result;
  } catch (error) {
    console.error('Phone verification: error verifying code:', error);
    return {
      success: false,
      error: 'Failed to verify code',
      details: process.env.NODE_ENV === 'development' ? getErrorMessage(error) : undefined,
    };
  }
}
