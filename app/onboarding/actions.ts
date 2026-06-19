"use server";

import { randomUUID } from "crypto";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCurrentTeamContext } from "@/lib/team-context";
import type { ActionState } from "@/lib/action-state";

export async function createTeam(
  _prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const name = (formData.get("name") as string)?.trim();
  const fathomKey = (formData.get("fathomKey") as string)?.trim();

  if (!name) {
    return { error: "Team name is required." };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    redirect("/login");
  }

  const existing = await getCurrentTeamContext();
  if (existing) {
    redirect("/");
  }

  const teamId = randomUUID();
  const { error: teamError } = await supabase
    .from("teams")
    .insert({ id: teamId, name });
  if (teamError) {
    return { error: teamError.message };
  }

  const { error: memberError } = await supabase
    .from("team_members")
    .insert({ team_id: teamId, user_id: user.id, role: "admin" });
  if (memberError) {
    return { error: memberError.message };
  }

  if (fathomKey) {
    const admin = createAdminClient();
    const { error: keyError } = await admin.rpc("set_team_fathom_key", {
      p_team_id: teamId,
      p_plaintext_key: fathomKey,
      p_passphrase: process.env.SUPABASE_DB_ENCRYPTION_KEY,
    });
    if (keyError) {
      return { error: keyError.message };
    }
  }

  redirect("/");
}
