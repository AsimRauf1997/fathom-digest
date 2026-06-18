import sgMail from "@sendgrid/mail";

export interface SendEmailInput {
  to: string[];
  subject: string;
  html: string;
  text?: string;
}

export interface SendEmailResponse {
  id?: string;
  [key: string]: unknown;
}

/**
 * Sends one email to all recipients via SendGrid.
 *
 * Requires SENDGRID_API_KEY and MAIL_FROM. MAIL_FROM must be a verified sender
 * in your SendGrid account.
 */
export async function sendEmail({
  to,
  subject,
  html,
  text,
}: SendEmailInput): Promise<SendEmailResponse> {
  const apiKey = process.env.SENDGRID_API_KEY;
  const fromEmail = process.env.MAIL_FROM;
  const fromName = process.env.MAIL_FROM_NAME;

  if (!apiKey) {
    throw new Error("SENDGRID_API_KEY is not set (see .env.example).");
  }
  if (!fromEmail) {
    throw new Error("MAIL_FROM is not set (use a SendGrid-verified sender).");
  }
  if (to.length === 0) {
    throw new Error("No recipients provided.");
  }

  sgMail.setApiKey(apiKey);
  const from = fromName ? `${fromName} <${fromEmail}>` : fromEmail;

  try {
    const response = await sgMail.send({
      from,
      to,
      subject,
      html,
      text,
      trackingSettings: {
        clickTracking: { enable: true },
        openTracking: { enable: true },
      },
    });

    return { id: response[0].headers["x-message-id"] || "" };
  } catch (error) {
    const detail =
      error instanceof Error ? error.message : JSON.stringify(error);
    throw new Error(`SendGrid send failed: ${detail}`);
  }
}
