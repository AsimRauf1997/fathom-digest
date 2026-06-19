import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { Alert } from "@/components/ui/alert";
import { FathomKeyForm } from "@/components/settings/fathom-key-form";
import { InviteMemberForm } from "@/components/settings/invite-member-form";
import { MemberRowActions } from "@/components/settings/member-row-actions";
import { InviteStatusBadge } from "@/components/settings/invite-status-badge";
import { ResendInviteButton } from "@/components/settings/resend-invite-button";
import AppHeader from "@/app/AppHeader";
import AppFooter from "@/app/AppFooter";

export const dynamic = "force-dynamic";

function longDate(d: Date): string {
  return d.toLocaleDateString(undefined, {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

export default async function SettingsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: membership } = await supabase
    .from("team_members")
    .select("team_id, role")
    .eq("user_id", user.id)
    .maybeSingle();
  if (!membership) redirect("/onboarding");

  const isAdmin = membership.role === "admin";

  const { data: team } = await supabase
    .from("teams")
    .select("id, name, fathom_api_key_enc")
    .eq("id", membership.team_id)
    .single();

  const { data: members } = await supabase
    .from("team_members")
    .select("id, user_id, role")
    .eq("team_id", membership.team_id);

  const { data: pendingInvites } = await supabase
    .from("invites")
    .select("id, email, status, created_at")
    .eq("team_id", membership.team_id)
    .eq("status", "pending")
    .order("created_at", { ascending: false });

  const admin = createAdminClient();
  const membersWithEmail = await Promise.all(
    (members ?? []).map(async (m) => {
      const { data } = await admin.auth.admin.getUserById(m.user_id);
      return { ...m, email: data.user?.email ?? m.user_id };
    }),
  );

  const hasFathomKey = Boolean(team?.fathom_api_key_enc);

  return (
    <div className="wrap">
      <AppHeader />

      <div className="page-head">
        <span className="auth-eyebrow">Workspace</span>
        <h1 className="page-title">{team?.name ?? "Settings"}</h1>
        <p className="muted" style={{ fontSize: 13 }}>
          {isAdmin ? "You're an admin of this team." : "You're a member of this team."}
        </p>
      </div>

      <div className="settings-grid">
        <section className="panel">
          <div className="col-head">
            <h2>Fathom API key</h2>
          </div>

          {hasFathomKey ? (
            <Alert variant="ok" className="mb-4">
              A Fathom API key is configured for this team.
            </Alert>
          ) : (
            <Alert variant="err" className="mb-4">
              No Fathom API key set yet — meetings won&apos;t load until one is
              added.
            </Alert>
          )}

          {isAdmin && <FathomKeyForm hasFathomKey={hasFathomKey} />}
        </section>

        <section className="panel">
          <div className="col-head">
            <h2>Members</h2>
            <span className="count">
              {membersWithEmail.length} member
              {membersWithEmail.length === 1 ? "" : "s"}
            </span>
          </div>

          <ul className="member-list">
            {membersWithEmail.map((m) => (
              <li className="member-row" key={m.id}>
                <span className="member-email">{m.email}</span>
                <span className="member-role">{m.role}</span>
                {isAdmin && m.user_id !== user.id && (
                  <span className="member-actions">
                    <MemberRowActions memberId={m.id} role={m.role} />
                  </span>
                )}
              </li>
            ))}
            {pendingInvites?.map((invite) => (
              <li className="member-row" key={invite.id} style={{ opacity: 0.7 }}>
                <span className="member-email">{invite.email}</span>
                <InviteStatusBadge status={invite.status} />
                {isAdmin && (
                  <span className="member-actions">
                    <ResendInviteButton inviteId={invite.id} />
                  </span>
                )}
              </li>
            ))}
          </ul>

          {isAdmin && (
            <>
              <div className="label-rule">Invite a member</div>
              <InviteMemberForm />
            </>
          )}
        </section>
      </div>

      <AppFooter date={longDate(new Date())} />
    </div>
  );
}
