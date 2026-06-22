import { NextResponse } from "next/server";
import { getTranscript } from "@/lib/fathom";
import { getCurrentTeamContext, getTeamFathomKey } from "@/lib/team-context";

export const dynamic = "force-dynamic";

/**
 * GET /api/transcript?recordingId=<id> -> transcript for a single recording
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const recordingId = searchParams.get("recordingId");

  try {
    const ctx = await getCurrentTeamContext();
    if (!ctx) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (!recordingId) {
      return NextResponse.json(
        { error: "Provide a recordingId." },
        { status: 400 },
      );
    }

    const apiKey = await getTeamFathomKey(ctx.teamId);
    if (!apiKey) {
      return NextResponse.json(
        { error: "No Fathom API key configured for your team. Add one in Settings." },
        { status: 400 },
      );
    }

    const transcript = await getTranscript(apiKey, recordingId);
    return NextResponse.json({ transcript });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
