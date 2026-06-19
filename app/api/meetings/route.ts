import { NextResponse } from "next/server";
import { listMeetings } from "@/lib/fathom";
import { getCurrentTeamContext, getTeamFathomKey } from "@/lib/team-context";

export const dynamic = "force-dynamic";

/**
 * GET /api/meetings?date=YYYY-MM-DD -> all meetings that day
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const date = searchParams.get("date");

  try {
    const ctx = await getCurrentTeamContext();
    if (!ctx) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return NextResponse.json(
        { error: "Provide a date as YYYY-MM-DD." },
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

    // Whole-day window in UTC. (Good enough for a daily digest; can be made
    // timezone-aware later if meetings near midnight get misfiled.)
    const after = `${date}T00:00:00Z`;
    const beforeDate = new Date(`${date}T00:00:00Z`);
    beforeDate.setUTCDate(beforeDate.getUTCDate() + 1);
    const before = beforeDate.toISOString();

    const meetings = await listMeetings(apiKey, after, before);
    return NextResponse.json({ meetings });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
