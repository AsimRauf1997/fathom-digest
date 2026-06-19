import { redirect } from "next/navigation";
import { auth } from "@clerk/nextjs/server";
import { and, desc, eq } from "drizzle-orm";
import { Alert } from "@/components/ui/alert";
import { FathomKeyForm } from "@/components/settings/fathom-key-form";
import { InviteMemberForm } from "@/components/settings/invite-member-form";
import { MemberRowActions } from "@/components/settings/member-row-actions";
import { InviteStatusBadge } from "@/components/settings/invite-status-badge";
import { ResendInviteButton } from "@/components/settings/resend-invite-button";
import AppHeader from "@/app/AppHeader";
import AppFooter from "@/app/AppFooter";
import { db } from "@/lib/db";
import { invites, teamMembers, teams, users } from "@/lib/db/schema";

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
  const { userId } = await auth();
  if (!userId) redirect("/login");

  const membership = await db.query.teamMembers.findFirst({
    where: eq(teamMembers.userId, userId),
    columns: { teamId: true, role: true },
  });
  if (!membership) redirect("/onboarding");

  const isAdmin = membership.role === "admin";

  const team = await db.query.teams.findFirst({
    where: eq(teams.id, membership.teamId),
    columns: { id: true, name: true, fathomApiKeyEnc: true },
  });

  const membersWithEmail = await db
    .select({
      id: teamMembers.id,
      userId: teamMembers.userId,
      role: teamMembers.role,
      email: users.email,
    })
    .from(teamMembers)
    .innerJoin(users, eq(users.id, teamMembers.userId))
    .where(eq(teamMembers.teamId, membership.teamId));

  const pendingInvites = await db.query.invites.findMany({
    where: and(
      eq(invites.teamId, membership.teamId),
      eq(invites.status, "pending"),
    ),
    orderBy: [desc(invites.createdAt)],
    columns: { id: true, email: true, status: true, createdAt: true },
  });

  const hasFathomKey = Boolean(team?.fathomApiKeyEnc);

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
                {isAdmin && m.userId !== userId && (
                  <span className="member-actions">
                    <MemberRowActions memberId={m.id} role={m.role} />
                  </span>
                )}
              </li>
            ))}
            {pendingInvites.map((invite) => (
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
