import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export type TeamContext = {
  userId: string;
  teamId: string;
  role: "admin" | "member";
};

export async function getCurrentTeamContext(): Promise<TeamContext | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: membership } = await supabase
    .from("team_members")
    .select("team_id, role")
    .eq("user_id", user.id)
    .maybeSingle();
  if (!membership) return null;

  return { userId: user.id, teamId: membership.team_id, role: membership.role };
}

export async function getTeamFathomKey(teamId: string): Promise<string | null> {
  const admin = createAdminClient();
  const { data, error } = await admin.rpc("get_team_fathom_key", {
    p_team_id: teamId,
    p_passphrase: process.env.SUPABASE_DB_ENCRYPTION_KEY,
  });
  if (error) throw error;
  return data ?? null;
}
