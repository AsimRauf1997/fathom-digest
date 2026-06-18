import { NextResponse } from "next/server";
import type { Meeting } from "@/lib/types";
import { renderDigestEmail } from "@/lib/render-email";

export const dynamic = "force-dynamic";

interface PreviewBody {
  label?: string;
  intro?: string;
  meetings?: Meeting[];
}

/**
 * POST /api/preview { label, meetings, intro }
 * Renders the email template and returns { subject, html } for the live preview.
 */
export async function POST(request: Request) {
  let body: PreviewBody;
  try {
    body = (await request.json()) as PreviewBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const label = (body.label ?? "").trim() || "your meetings";
  const meetings = Array.isArray(body.meetings) ? body.meetings : [];

  try {
    const { subject, html } = await renderDigestEmail({
      label,
      meetings,
      intro: body.intro,
    });
    return NextResponse.json({ subject, html });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
