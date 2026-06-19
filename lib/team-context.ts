import "server-only";
import { auth } from "@clerk/nextjs/server";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { teamMembers, teams } from "@/lib/db/schema";
import { decryptFathomKey } from "@/lib/crypto/fathom-key";

export type TeamContext = {
  userId: string;
  teamId: string;
  role: "admin" | "member";
};

export async function getCurrentTeamContext(): Promise<TeamContext | null> {
  const { userId } = await auth();
  if (!userId) return null;

  const membership = await db.query.teamMembers.findFirst({
    where: eq(teamMembers.userId, userId),
    columns: { teamId: true, role: true },
  });
  if (!membership) return null;

  return { userId, teamId: membership.teamId, role: membership.role };
}

export async function getTeamFathomKey(teamId: string): Promise<string | null> {
  const team = await db.query.teams.findFirst({
    where: eq(teams.id, teamId),
    columns: { fathomApiKeyEnc: true },
  });
  if (!team?.fathomApiKeyEnc) return null;
  return decryptFathomKey(team.fathomApiKeyEnc);
}
