"use server";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCurrentTeamContext } from "@/lib/team-context";
import type { ActionState } from "@/lib/action-state";

export async function acceptInvite(): Promise<ActionState> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user?.email) return { error: "Not signed in." };

  const admin = createAdminClient();
  const { data: invite } = await admin
    .from("invites")
    .select("id, team_id")
    .eq("email", user.email.toLowerCase())
    .eq("status", "pending")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!invite) return { error: "No pending invite found for this account." };

  const ctx = await getCurrentTeamContext();
  if (ctx && ctx.teamId !== invite.team_id) {
    return {
      error: "You're already part of a team. Leave your current team before accepting this invite.",
    };
  }

  if (!ctx) {
    const { error: memberError } = await admin
      .from("team_members")
      .insert({ team_id: invite.team_id, user_id: user.id, role: "member" });
    if (memberError) return { error: memberError.message };
  }

  const { error: updateError } = await admin
    .from("invites")
    .update({
      status: "accepted",
      accepted_at: new Date().toISOString(),
      invited_user_id: user.id,
    })
    .eq("id", invite.id);
  if (updateError) return { error: updateError.message };

  return null;
}
