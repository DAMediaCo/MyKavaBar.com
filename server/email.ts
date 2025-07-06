import { Resend } from "resend";

const RESEND_API_KEY = process.env.RESEND_API_KEY;
const RESEND_VERIFIED_SENDER = process.env.RESEND_VERIFIED_SENDER;

if (!RESEND_API_KEY) {
  throw new Error("RESEND_API_KEY environment variable is required");
}
if (!RESEND_VERIFIED_SENDER) {
  throw new Error("RESEND_VERIFIED_SENDER environment variable is required");
}

const resend = new Resend(RESEND_API_KEY);

const MAX_RETRIES = 3;
const RETRY_DELAY = 1000; // 1 second

async function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function sendPasswordResetEmail(email: string, resetLink: string) {
  console.log("Attempting to send password reset email with Resend");
  console.log("Using verified sender:", RESEND_VERIFIED_SENDER);

  const emailData = {
    from: `${"MyKavaBar Support"} <${RESEND_VERIFIED_SENDER}>`,
    to: email,
    subject: "Reset Your MyKavaBar Password",
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
      console.log(`Resend attempt ${attempt}/${MAX_RETRIES}`);
      const result = await resend.emails.send(emailData);
      console.log("Resend API response:", result);
      console.log(
        `Password reset email sent successfully on attempt ${attempt}`,
      );
      return result;
    } catch (error: any) {
      lastError = error;
      console.error(`Resend attempt ${attempt} failed:`, error);

      if (attempt < MAX_RETRIES) {
        await delay(RETRY_DELAY * attempt);
        continue;
      }

      throw new Error(
        `Failed to send password reset email after ${MAX_RETRIES} attempts. Last error: ${lastError.message}`,
      );
    }
  }
}

export async function sendNotificationEmail(email: string) {
  console.log("Attempting to send notification email with Resend");
  console.log("Using verified sender:", RESEND_VERIFIED_SENDER);

  const emailData = {
    from: `${"MyKavaBar Notifications"} <${RESEND_VERIFIED_SENDER}>`,
    to: email,
    subject: "New Notification",
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <p>Check who it is</p>
      </div>
    `,
  };

  let lastError: any;
  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      console.log(`Resend notification attempt ${attempt}/${MAX_RETRIES}`);
      const result = await resend.emails.send(emailData);
      console.log("Resend API response:", result);
      console.log(`Notification email sent successfully on attempt ${attempt}`);
      return result;
    } catch (error: any) {
      lastError = error;
      console.error(`Resend attempt ${attempt} failed:`, error);

      if (attempt < MAX_RETRIES) {
        await delay(RETRY_DELAY * attempt);
        continue;
      }

      throw new Error(
        `Failed to send notification email after ${MAX_RETRIES} attempts. Last error: ${lastError.message}`,
      );
    }
  }
}
