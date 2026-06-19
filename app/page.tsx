import { redirect } from "next/navigation";
import DigestApp from "./DigestApp";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function Page() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: membership } = await supabase
    .from("team_members")
    .select("team_id")
    .eq("user_id", user.id)
    .maybeSingle();
  if (!membership) redirect("/onboarding");

  const { data: team } = await supabase
    .from("teams")
    .select("fathom_api_key_enc")
    .eq("id", membership.team_id)
    .single();

  return <DigestApp initialRecipients={[]} hasFathomKey={Boolean(team?.fathom_api_key_enc)} />;
}
