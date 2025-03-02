import sgMail from '@sendgrid/mail';
import type { MailDataRequired } from '@sendgrid/mail';

// Verify environment variables are set
const SENDGRID_API_KEY = process.env.SENDGRID_API_KEY;
const SENDGRID_VERIFIED_SENDER = process.env.SENDGRID_VERIFIED_SENDER;

if (!SENDGRID_API_KEY) {
  throw new Error('SENDGRID_API_KEY environment variable is required');
}

if (!SENDGRID_VERIFIED_SENDER) {
  throw new Error('SENDGRID_VERIFIED_SENDER environment variable is required');
}

// Initialize SendGrid with API key
sgMail.setApiKey(SENDGRID_API_KEY);

const MAX_RETRIES = 3;
const RETRY_DELAY = 1000; // 1 second

async function delay(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

export async function sendPasswordResetEmail(email: string, resetLink: string) {
  console.log('Attempting to send password reset email with SendGrid');
  console.log('Using verified sender:', SENDGRID_VERIFIED_SENDER);

  const msg: MailDataRequired = {
    to: email,
    from: {
      email: SENDGRID_VERIFIED_SENDER,
      name: 'MyKavaBar Support'
    },
    subject: 'Reset Your MyKavaBar Password',
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2>Reset Your Password</h2>
        <p>Someone (hopefully you) has requested to reset your MyKavaBar password.</p>
        <p>Click the link below to set a new password:</p>
        <p>
          <a href="${resetLink}" style="display: inline-block; padding: 10px 20px; background-color: #4B0082; color: white; text-decoration: none; border-radius: 5px;">
            Reset Password
          </a>
        </p>
        <p>This link will expire in 1 hour for security reasons.</p>
        <p>If you didn't request this reset, you can safely ignore this email.</p>
        <p>Best regards,<br>The MyKavaBar Team</p>
      </div>
    `,
  };

  let lastError: any;
  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      console.log(`SendGrid attempt ${attempt}/${MAX_RETRIES}`);
      // Attempt to send email
      const result = await sgMail.send(msg);
      console.log('SendGrid API response:', result);
      console.log(`Password reset email sent successfully on attempt ${attempt}`);
      return result;
    } catch (error: any) {
      lastError = error;
      console.error(`SendGrid attempt ${attempt} failed:`, {
        error: error.message,
        code: error.code,
        response: error.response?.body,
        headers: error.response?.headers,
        stack: error.stack
      });

      // If we have more attempts left, wait before retrying
      if (attempt < MAX_RETRIES) {
        await delay(RETRY_DELAY * attempt);
        continue;
      }

      // If we're here, we've exhausted all retries
      throw new Error(
        `Failed to send password reset email after ${MAX_RETRIES} attempts. Last error: ${lastError.message}`
      );
    }
  }
}