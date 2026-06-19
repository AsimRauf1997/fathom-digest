"use server";

import { auth, clerkClient } from "@clerk/nextjs/server";
import { and, desc, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { invites, teamMembers, users } from "@/lib/db/schema";
import { getCurrentTeamContext } from "@/lib/team-context";
import type { ActionState } from "@/lib/action-state";

export async function acceptInvite(): Promise<ActionState> {
  const { userId } = await auth();
  if (!userId) return { error: "Not signed in." };

  const clerk = await clerkClient();
  const user = await clerk.users.getUser(userId);
  const email = user.emailAddresses
    .find((e) => e.id === user.primaryEmailAddressId)
    ?.emailAddress?.toLowerCase();
  if (!email) return { error: "Not signed in." };

  // Ensure user record exists (create if missing due to signup issues)
  const existingUser = await db.query.users.findFirst({
    where: eq(users.id, userId),
    columns: { id: true },
  });

  if (!existingUser) {
    await db.insert(users).values({
      id: userId,
      email: email,
      name: user.firstName && user.lastName ? `${user.firstName} ${user.lastName}` : user.firstName || null,
      avatarUrl: user.imageUrl || null,
    });
  }

  const invite = await db.query.invites.findFirst({
    where: and(eq(invites.email, email), eq(invites.status, "pending")),
    orderBy: [desc(invites.createdAt)],
    columns: { id: true, teamId: true },
  });

  if (!invite) return { error: "No pending invite found for this account." };

  const ctx = await getCurrentTeamContext();
  if (ctx && ctx.teamId !== invite.teamId) {
    return {
      error: "You're already part of a team. Leave your current team before accepting this invite.",
    };
  }

  if (!ctx) {
    const existingMember = await db.query.teamMembers.findFirst({
      where: and(
        eq(teamMembers.userId, userId),
        eq(teamMembers.teamId, invite.teamId)
      ),
      columns: { id: true },
    });

    if (!existingMember) {
      await db.insert(teamMembers).values({
        teamId: invite.teamId,
        userId,
        role: "member",
      });
    }
  }

  await db
    .update(invites)
    .set({
      status: "accepted",
      acceptedAt: new Date(),
      invitedUserId: userId,
    })
    .where(eq(invites.id, invite.id));

  return null;
}
