"use server";

import { revalidatePath } from "next/cache";
import { clerkClient } from "@clerk/nextjs/server";
import { and, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { invites, teamMembers, teams } from "@/lib/db/schema";
import { encryptFathomKey } from "@/lib/crypto/fathom-key";
import { getCurrentTeamContext, type TeamContext } from "@/lib/team-context";
import type { ActionState } from "@/lib/action-state";
import { sendEmail } from "@/lib/mailer";
import { renderTeamInviteEmail } from "@/lib/render-email";

async function requireAdminContext(): Promise<
  { ctx: TeamContext } | { error: string }
> {
  const ctx = await getCurrentTeamContext();
  if (!ctx) return { error: "Not signed in or no team." };
  if (ctx.role !== "admin") return { error: "Only team admins can do this." };
  return { ctx };
}

function siteUrl(): string {
  return process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
}

async function sendExistingUserInviteEmail({
  teamId,
  inviterUserId,
  email,
}: {
  teamId: string;
  inviterUserId: string;
  email: string;
}) {
  const team = await db.query.teams.findFirst({
    where: eq(teams.id, teamId),
    columns: { name: true },
  });
  const teamName = team?.name ?? "your team";

  const clerk = await clerkClient();
  const inviter = await clerk.users.getUser(inviterUserId);
  const inviterEmail =
    inviter.emailAddresses.find((e) => e.id === inviter.primaryEmailAddressId)
      ?.emailAddress ?? "a team admin";

  const acceptUrl = `${siteUrl()}/accept-invite?existing=1`;

  try {
    const { subject, html, text } = await renderTeamInviteEmail({
      teamName,
      inviterEmail,
      acceptUrl,
    });
    await sendEmail({ to: [email], subject, html, text });
  } catch (emailError) {
    console.error("Failed to send team invite email:", emailError);
  }
}

export async function updateFathomKey(
  _prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const result = await requireAdminContext();
  if ("error" in result) return { error: result.error };

  const fathomKey = (formData.get("fathomKey") as string)?.trim();
  if (!fathomKey) return { error: "Fathom API key cannot be empty." };

  await db
    .update(teams)
    .set({ fathomApiKeyEnc: encryptFathomKey(fathomKey) })
    .where(eq(teams.id, result.ctx.teamId));

  revalidatePath("/settings");
  revalidatePath("/");
  return null;
}

export async function inviteMember(
  _prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const result = await requireAdminContext();
  if ("error" in result) return { error: result.error };

  const email = (formData.get("email") as string)?.trim().toLowerCase();
  if (!email) return { error: "Email is required." };

  const existingInvite = await db.query.invites.findFirst({
    where: and(
      eq(invites.teamId, result.ctx.teamId),
      eq(invites.email, email),
      eq(invites.status, "pending"),
    ),
    columns: { id: true },
  });
  if (existingInvite) {
    return { error: "This email already has a pending invite." };
  }

  const clerk = await clerkClient();
  const { data: existingUsers } = await clerk.users.getUserList({
    emailAddress: [email],
  });
  const existingUser = existingUsers[0];

  let invitedUserId: string | null = null;

  if (existingUser) {
    invitedUserId = existingUser.id;
    await sendExistingUserInviteEmail({
      teamId: result.ctx.teamId,
      inviterUserId: result.ctx.userId,
      email,
    });
  } else {
    try {
      await clerk.invitations.createInvitation({
        emailAddress: email,
        redirectUrl: `${siteUrl()}/sso-callback`,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Could not send invitation.";
      return { error: message };
    }
  }

  await db.insert(invites).values({
    teamId: result.ctx.teamId,
    email,
    invitedBy: result.ctx.userId,
    invitedUserId,
    status: "pending",
  });

  revalidatePath("/settings");
  return null;
}

export async function resendInvite(
  _prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const result = await requireAdminContext();
  if ("error" in result) return { error: result.error };

  const inviteId = formData.get("inviteId") as string;
  if (!inviteId) return { error: "Missing invite ID." };

  const invite = await db.query.invites.findFirst({
    where: eq(invites.id, inviteId),
    columns: { email: true, teamId: true, invitedUserId: true, status: true },
  });

  if (!invite) return { error: "Invite not found." };
  if (invite.teamId !== result.ctx.teamId) {
    return { error: "Not authorized to resend this invite." };
  }
  if (invite.status !== "pending") {
    return { error: "This invite is no longer pending." };
  }

  const clerk = await clerkClient();

  if (invite.invitedUserId) {
    await sendExistingUserInviteEmail({
      teamId: result.ctx.teamId,
      inviterUserId: result.ctx.userId,
      email: invite.email,
    });
  } else {
    const { data: pendingInvitations } = await clerk.invitations.getInvitationList({
      status: "pending",
      query: invite.email,
    });
    for (const pending of pendingInvitations) {
      if (pending.emailAddress.toLowerCase() === invite.email.toLowerCase()) {
        await clerk.invitations.revokeInvitation(pending.id);
      }
    }

    try {
      await clerk.invitations.createInvitation({
        emailAddress: invite.email,
        redirectUrl: `${siteUrl()}/sso-callback`,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Could not resend invitation.";
      return { error: message };
    }
  }

  revalidatePath("/settings");
  return null;
}

export async function updateMemberRole(
  _prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const result = await requireAdminContext();
  if ("error" in result) return { error: result.error };

  const memberId = formData.get("memberId") as string;
  const role = formData.get("role") as "admin" | "member";
  if (!memberId || !role) return { error: "Missing member or role." };

  try {
    await db.transaction(async (tx) => {
      if (role === "member") {
        const member = await tx.query.teamMembers.findFirst({
          where: eq(teamMembers.id, memberId),
          columns: { id: true },
        });

        if (member) {
          const remainingAdmins = await tx.query.teamMembers.findMany({
            where: and(
              eq(teamMembers.teamId, result.ctx.teamId),
              eq(teamMembers.role, "admin"),
            ),
            columns: { id: true },
          });

          if (remainingAdmins.length === 1) {
            throw new Error("Cannot remove the last admin.");
          }
        }
      }

      await tx
        .update(teamMembers)
        .set({ role })
        .where(eq(teamMembers.id, memberId));
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Could not update role.";
    return { error: message };
  }

  revalidatePath("/settings");
  return null;
}

export async function removeMember(
  _prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const result = await requireAdminContext();
  if ("error" in result) return { error: result.error };

  const memberId = formData.get("memberId") as string;
  if (!memberId) return { error: "Missing member." };

  try {
    await db.transaction(async (tx) => {
      const member = await tx.query.teamMembers.findFirst({
        where: eq(teamMembers.id, memberId),
        columns: { role: true },
      });

      if (member?.role === "admin") {
        const remainingAdmins = await tx.query.teamMembers.findMany({
          where: and(
            eq(teamMembers.teamId, result.ctx.teamId),
            eq(teamMembers.role, "admin"),
          ),
          columns: { id: true },
        });

        if (remainingAdmins.length === 1) {
          throw new Error("Cannot remove the last admin.");
        }
      }

      await tx.delete(teamMembers).where(eq(teamMembers.id, memberId));
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Could not remove member.";
    return { error: message };
  }

  revalidatePath("/settings");
  return null;
}
