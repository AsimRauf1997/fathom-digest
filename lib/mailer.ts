import { Resend } from "resend";

export interface SendEmailInput {
  to: string[];
  subject: string;
  html: string;
  text?: string;
}

/**
 * Sends one email to all recipients via Resend.
 *
 * Requires RESEND_API_KEY and MAIL_FROM. For production, MAIL_FROM must be on a
 * domain you've verified in Resend; for quick testing you can use
 * "onboarding@resend.dev" (which only delivers to your own account email).
 */
export async function sendEmail({ to, subject, html, text }: SendEmailInput) {
  const apiKey = process.env.RESEND_API_KEY;
  const fromEmail = process.env.MAIL_FROM;
  const fromName = process.env.MAIL_FROM_NAME;

  if (!apiKey) {
    throw new Error("RESEND_API_KEY is not set (see .env.example).");
  }
  if (!fromEmail) {
    throw new Error("MAIL_FROM is not set (use a Resend-verified sender).");
  }
  if (to.length === 0) {
    throw new Error("No recipients provided.");
  }

  const resend = new Resend(apiKey);
  const from = fromName ? `${fromName} <${fromEmail}>` : fromEmail;

  const { data, error } = await resend.emails.send({
    from,
    to,
    subject,
    html,
    ...(text ? { text } : {}),
  });

  if (error) {
    const detail =
      typeof error === "object" && error
        ? (error as { message?: string }).message || JSON.stringify(error)
        : String(error);
    throw new Error(`Resend send failed: ${detail}`);
  }

  return data;
}
