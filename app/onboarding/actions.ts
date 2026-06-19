"use server";

import { redirect } from "next/navigation";
import { auth, currentUser } from "@clerk/nextjs/server";
import { db } from "@/lib/db";
import { teamMembers, teams, users } from "@/lib/db/schema";
import { encryptFathomKey } from "@/lib/crypto/fathom-key";
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

  const { userId } = await auth();
  if (!userId) {
    redirect("/login");
  }

  const existing = await getCurrentTeamContext();
  if (existing) {
    redirect("/");
  }

  const clerkUser = await currentUser();
  if (!clerkUser?.id) {
    return { error: "Unable to fetch user information." };
  }

  await db
    .insert(users)
    .values({
      id: clerkUser.id,
      email:
        clerkUser.emailAddresses[0]?.emailAddress ||
        clerkUser.primaryEmailAddress?.emailAddress ||
        "",
      name:
        [clerkUser.firstName, clerkUser.lastName].filter(Boolean).join(" ") ||
        null,
      avatarUrl: clerkUser.imageUrl || null,
    })
    .onConflictDoUpdate({
      target: users.id,
      set: {
        email:
          clerkUser.emailAddresses[0]?.emailAddress ||
          clerkUser.primaryEmailAddress?.emailAddress ||
          "",
        name:
          [clerkUser.firstName, clerkUser.lastName]
            .filter(Boolean)
            .join(" ") || null,
        avatarUrl: clerkUser.imageUrl || null,
        updatedAt: new Date(),
      },
    });

  const [team] = await db
    .insert(teams)
    .values({
      name,
      fathomApiKeyEnc: fathomKey ? encryptFathomKey(fathomKey) : null,
    })
    .returning({ id: teams.id });

  await db.insert(teamMembers).values({
    teamId: team.id,
    userId,
    role: "admin",
  });

  redirect("/");
}
