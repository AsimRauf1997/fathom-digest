import { NextResponse } from "next/server";
import type { Meeting } from "@/lib/types";
import { renderDigestEmail } from "@/lib/render-email";
import { sendEmail } from "@/lib/mailer";

export const dynamic = "force-dynamic";

interface SendBody {
  recipients?: string[];
  subject?: string;
  label?: string;
  intro?: string;
  meetings?: Meeting[];
}

const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

/**
 * POST /api/send { recipients, subject, label, meetings, intro }
 * The email body is always (re)rendered server-side from the template, so what
 * is sent matches the template exactly — the client cannot ship broken HTML.
 */
export async function POST(request: Request) {
  let body: SendBody;
  try {
    body = (await request.json()) as SendBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const recipients = (body.recipients ?? [])
    .map((r) => r.trim())
    .filter(Boolean);
  const label = (body.label ?? "").trim() || "your meetings";
  const meetings = Array.isArray(body.meetings) ? body.meetings : [];

  if (recipients.length === 0) {
    return NextResponse.json(
      { error: "Add at least one recipient." },
      { status: 400 },
    );
  }
  const invalid = recipients.filter((r) => !EMAIL_RE.test(r));
  if (invalid.length > 0) {
    return NextResponse.json(
      { error: `Invalid email address: ${invalid.join(", ")}` },
      { status: 400 },
    );
  }
  if (meetings.length === 0) {
    return NextResponse.json(
      { error: "Nothing to send — no meetings loaded." },
      { status: 400 },
    );
  }

  try {
    const rendered = await renderDigestEmail({
      label,
      meetings,
      intro: body.intro,
    });
    const subject = (body.subject ?? "").trim() || rendered.subject;

    await sendEmail({
      to: recipients,
      subject,
      html: rendered.html,
      text: rendered.text,
    });
    return NextResponse.json({ ok: true, sentTo: recipients });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
