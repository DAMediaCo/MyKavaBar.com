import sgMail from "@sendgrid/mail";

const SENDGRID_API_KEY = process.env.SENDGRID_API_KEY;
const RESEND_VERIFIED_SENDER = process.env.RESEND_VERIFIED_SENDER; // reusing this env var as the from address

if (!SENDGRID_API_KEY) {
  throw new Error("SENDGRID_API_KEY environment variable is required");
}
if (!RESEND_VERIFIED_SENDER) {
  throw new Error("RESEND_VERIFIED_SENDER environment variable is required");
}

sgMail.setApiKey(SENDGRID_API_KEY);

const MAX_RETRIES = 3;
const RETRY_DELAY = 1000;

async function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function sendPasswordResetEmail(email: string, resetLink: string) {
  console.log("Sending password reset email via SendGrid to:", email);

  const msg = {
    to: email,
    from: { name: "MyKavaBar Support", email: RESEND_VERIFIED_SENDER! },
    subject: "Reset Your MyKavaBar Password",
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #1a1a1b; color: #ffffff; padding: 32px; border-radius: 12px;">
        <h2 style="color: #D35400; margin-bottom: 16px;">Reset Your Password</h2>
        <p style="color: #ccc;">Someone (hopefully you) has requested to reset your MyKavaBar password.</p>
        <p style="color: #ccc;">Click the button below to set a new password:</p>
        <p style="margin: 24px 0;">
          <a href="${resetLink}" style="display: inline-block; padding: 12px 28px; background-color: #D35400; color: white; text-decoration: none; border-radius: 8px; font-weight: bold;">
            Reset Password
          </a>
        </p>
        <p style="color: #888; font-size: 13px;">This link will expire in 1 hour. If you didn't request this, you can safely ignore this email.</p>
        <p style="color: #888; font-size: 13px;">— The MyKavaBar Team</p>
      </div>
    `,
  };

  let lastError: any;
  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      console.log(`SendGrid attempt ${attempt}/${MAX_RETRIES}`);
      const result = await sgMail.send(msg);
      console.log("SendGrid response:", result[0].statusCode);
      return result;
    } catch (error: any) {
      lastError = error;
      console.error(`SendGrid attempt ${attempt} failed:`, error?.response?.body || error.message);
      if (attempt < MAX_RETRIES) {
        await delay(RETRY_DELAY * attempt);
        continue;
      }
      throw new Error(
        `Failed to send password reset email after ${MAX_RETRIES} attempts. Last error: ${lastError.message}`
      );
    }
  }
}

export async function sendNotificationEmail(to: string, subject = "New Notification", body = "You have a new notification on MyKavaBar.") {
  console.log("Sending notification email via SendGrid to:", to);

  const msg = {
    to,
    from: { name: "MyKavaBar", email: RESEND_VERIFIED_SENDER! },
    subject,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #1a1a1b; color: #ffffff; padding: 32px; border-radius: 12px;">
        <h2 style="color: #D35400;">MyKavaBar</h2>
        <p style="color: #ccc;">${body}</p>
        <p style="color: #888; font-size: 13px;">— The MyKavaBar Team</p>
      </div>
    `,
  };

  let lastError: any;
  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      console.log(`SendGrid notification attempt ${attempt}/${MAX_RETRIES}`);
      const result = await sgMail.send(msg);
      console.log("SendGrid response:", result[0].statusCode);
      return result;
    } catch (error: any) {
      lastError = error;
      console.error(`SendGrid attempt ${attempt} failed:`, error?.response?.body || error.message);
      if (attempt < MAX_RETRIES) {
        await delay(RETRY_DELAY * attempt);
        continue;
      }
      throw new Error(
        `Failed to send notification email after ${MAX_RETRIES} attempts. Last error: ${lastError.message}`
      );
    }
  }
}
