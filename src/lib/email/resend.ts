import { Resend } from "resend";
import { getServerEnv } from "@/lib/env";

let cachedClient: Resend | null = null;

function getClient(): Resend {
  if (!cachedClient) {
    const { RESEND_API_KEY } = getServerEnv();
    if (!RESEND_API_KEY) throw new Error("RESEND_API_KEY is not set — cannot send email");
    cachedClient = new Resend(RESEND_API_KEY);
  }
  return cachedClient;
}

export async function sendPasswordResetEmail(to: string, resetUrl: string): Promise<void> {
  const { EMAIL_FROM } = getServerEnv();

  const { error } = await getClient().emails.send({
    from: EMAIL_FROM,
    to,
    subject: "Reset your password",
    html: `
      <p>Someone requested a password reset for your account.</p>
      <p><a href="${resetUrl}">Click here to reset your password</a>. This link expires in 1 hour.</p>
      <p>If you didn't request this, you can safely ignore this email.</p>
    `,
  });

  if (error) {
    throw new Error(`Failed to send password reset email: ${error.message}`);
  }
}
