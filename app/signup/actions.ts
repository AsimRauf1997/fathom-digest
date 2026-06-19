"use server";

import { auth, clerkClient } from "@clerk/nextjs/server";
import { and, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { users, invites, teamMembers } from "@/lib/db/schema";
import type { ActionState } from "@/lib/action-state";

export async function createUserRecord(userData: {
  id: string;
  email: string;
  name: string | null;
  avatarUrl: string | null;
}) {
  try {
    await db.insert(users).values({
      id: userData.id,
      email: userData.email,
      name: userData.name,
      avatarUrl: userData.avatarUrl,
    });
  } catch (error) {
    console.error("Failed to create user record:", error);
    throw error;
  }
}

export async function acceptSignupInvite(
  inviteId: string,
): Promise<ActionState> {
  const { userId } = await auth();
  if (!userId) return { error: "Not signed in." };

  const clerk = await clerkClient();
  const user = await clerk.users.getUser(userId);
  const email = user.emailAddresses
    .find((e) => e.id === user.primaryEmailAddressId)
    ?.emailAddress?.toLowerCase();

  if (!email) return { error: "Could not verify email." };

  // Find and validate the invite
  const invite = await db.query.invites.findFirst({
    where: and(
      eq(invites.id, inviteId),
      eq(invites.status, "pending"),
    ),
    columns: { id: true, teamId: true, email: true },
  });

  if (!invite) {
    return { error: "Invite not found or no longer valid." };
  }

  // Verify the email matches the invite
  if (invite.email.toLowerCase() !== email) {
    return {
      error: "This invite is for a different email address. Please sign in with the invited email.",
    };
  }

  // Check if user is already in a team (can only be in one team)
  const existingMembership = await db.query.teamMembers.findFirst({
    where: eq(teamMembers.userId, userId),
    columns: { teamId: true },
  });

  if (existingMembership) {
    if (existingMembership.teamId === invite.teamId) {
      // User already in this team, just mark invite as accepted
      await db
        .update(invites)
        .set({
          status: "accepted",
          acceptedAt: new Date(),
          invitedUserId: userId,
        })
        .where(eq(invites.id, inviteId));
      return null;
    }
    // User in different team, cannot join
    return {
      error: "You're already part of a team. Leave your current team before accepting this invite.",
    };
  }

  // Create team membership and mark invite as accepted
  try {
    await db.transaction(async (tx) => {
      // Add user to team
      await tx.insert(teamMembers).values({
        teamId: invite.teamId,
        userId,
        role: "member",
      });

      // Mark invite as accepted
      await tx
        .update(invites)
        .set({
          status: "accepted",
          acceptedAt: new Date(),
          invitedUserId: userId,
        })
        .where(eq(invites.id, inviteId));
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to accept invite.";
    return { error: message };
  }

  return null;
}
