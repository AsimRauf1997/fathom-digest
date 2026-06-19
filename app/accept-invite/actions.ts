"use server";

import { auth, clerkClient } from "@clerk/nextjs/server";
import { and, desc, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { invites, teamMembers } from "@/lib/db/schema";
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
    await db.insert(teamMembers).values({
      teamId: invite.teamId,
      userId,
      role: "member",
    });
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
