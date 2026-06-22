"use server";

import { revalidatePath } from "next/cache";
import { clerkClient } from "@clerk/nextjs/server";
import { and, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { invites, teamMembers, teams, users } from "@/lib/db/schema";
import { encryptFathomKey } from "@/lib/crypto/fathom-key";
import { getCurrentTeamContext, type TeamContext } from "@/lib/team-context";
import type { ActionState } from "@/lib/action-state";

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

async function sendNewUserInviteEmail({
  inviteId,
  teamId,
  inviterUserId,
  email,
}: {
  inviteId: string;
  teamId: string;
  inviterUserId: string;
  email: string;
}) {
  const clerk = await clerkClient();

  try {
    // Use Clerk's built-in invitation system (Clerk sends the email for free)
    // The redirect will go to /signup with the invite token, where user can sign up
    // and automatically join the team
    await clerk.invitations.createInvitation({
      emailAddress: email,
      redirectUrl: `${siteUrl()}/signup?inviteToken=${inviteId}`,
    });
  } catch (err) {
    console.error("Failed to send Clerk invitation:", err);
    // Even if Clerk invitation fails, we keep the invite record
    // User can still access via direct link
  }
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
  // For existing users, you could:
  // 1. Send email via SendGrid (requires SENDGRID_API_KEY)
  // 2. Send email via Resend (free tier available)
  // 3. Send no email - user finds invite in app or gets manual notification
  //
  // For now, logging that an existing user was invited
  // The user will see it in their dashboard or can be notified manually

  console.log(`Existing user ${email} was invited to team ${teamId}`);
  // TODO: Implement email or in-app notification for existing users
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

  // Clerk and our users table can drift out of sync (e.g. signup flow issues),
  // so backfill the user record before referencing it as a foreign key.
  if (existingUser) {
    const userRecord = await db.query.users.findFirst({
      where: eq(users.id, existingUser.id),
      columns: { id: true },
    });

    if (!userRecord) {
      await db.insert(users).values({
        id: existingUser.id,
        email,
        name:
          existingUser.firstName && existingUser.lastName
            ? `${existingUser.firstName} ${existingUser.lastName}`
            : existingUser.firstName || null,
        avatarUrl: existingUser.imageUrl || null,
      });
    }
  }

  // Create the invite record first to get the ID for the token
  const [invite] = await db.insert(invites).values({
    teamId: result.ctx.teamId,
    email,
    invitedBy: result.ctx.userId,
    invitedUserId: existingUser?.id ?? null,
    status: "pending",
  }).returning({ id: invites.id });

  if (!invite) {
    return { error: "Failed to create invite." };
  }

  // Send appropriate email based on whether user exists
  if (existingUser) {
    await sendExistingUserInviteEmail({
      teamId: result.ctx.teamId,
      inviterUserId: result.ctx.userId,
      email,
    });
  } else {
    // For new users, send email with signup link containing invite token
    await sendNewUserInviteEmail({
      inviteId: invite.id,
      teamId: result.ctx.teamId,
      inviterUserId: result.ctx.userId,
      email,
    });
  }

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
    columns: { email: true, teamId: true, invitedUserId: true, status: true, id: true },
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
    // For existing users, send custom email to accept invite
    await sendExistingUserInviteEmail({
      teamId: result.ctx.teamId,
      inviterUserId: result.ctx.userId,
      email: invite.email,
    });
  } else {
    // For new users, revoke old Clerk invitation and create a new one
    const { data: pendingInvitations } = await clerk.invitations.getInvitationList({
      status: "pending",
      query: invite.email,
    });

    for (const pending of pendingInvitations) {
      if (pending.emailAddress.toLowerCase() === invite.email.toLowerCase()) {
        await clerk.invitations.revokeInvitation(pending.id);
      }
    }

    // Send new Clerk invitation with signup link
    await sendNewUserInviteEmail({
      inviteId: invite.id,
      teamId: result.ctx.teamId,
      inviterUserId: result.ctx.userId,
      email: invite.email,
    });
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
