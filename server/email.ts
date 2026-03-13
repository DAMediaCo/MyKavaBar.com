import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY);
const FROM = process.env.RESEND_VERIFIED_SENDER || "info@mykavabar.com";

export async function sendPasswordResetEmail(email: string, resetLink: string) {
  console.log(`[Email] Sending password reset to ${email}`);
  const { data, error } = await resend.emails.send({
    from: `MyKavaBar Support <${FROM}>`,
    to: email,
    subject: "Reset Your MyKavaBar Password",
    html: `
      <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;background:#1a1a1b;color:#fff;padding:32px;border-radius:12px;">
        <h2 style="color:#D35400;">Reset Your Password</h2>
        <p style="color:#ccc;">Someone (hopefully you) requested a password reset for your MyKavaBar account.</p>
        <p style="margin:24px 0;">
          <a href="${resetLink}" style="display:inline-block;padding:12px 28px;background:#D35400;color:#fff;text-decoration:none;border-radius:8px;font-weight:bold;">
            Reset Password
          </a>
        </p>
        <p style="color:#888;font-size:13px;">This link expires in 1 hour. If you didn't request this, ignore this email.</p>
        <p style="color:#888;font-size:13px;">— The MyKavaBar Team</p>
      </div>
    `,
  });
  if (error) throw new Error(`Resend error: ${error.message}`);
  console.log(`[Email] Password reset sent, id: ${data?.id}`);
  return data;
}

export async function sendNotificationEmail(
  to: string,
  subject = "New Notification",
  body = "You have a new notification on MyKavaBar."
) {
  console.log(`[Email] Sending notification to ${to}`);
  const { data, error } = await resend.emails.send({
    from: `MyKavaBar <${FROM}>`,
    to,
    subject,
    html: `
      <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;background:#1a1a1b;color:#fff;padding:32px;border-radius:12px;">
        <h2 style="color:#D35400;">MyKavaBar</h2>
        <p style="color:#ccc;">${body}</p>
        <p style="color:#888;font-size:13px;">— The MyKavaBar Team</p>
      </div>
    `,
  });
  if (error) throw new Error(`Resend error: ${error.message}`);
  console.log(`[Email] Notification sent, id: ${data?.id}`);
  return data;
}
