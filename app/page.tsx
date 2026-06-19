import { redirect } from "next/navigation";
import { auth, currentUser } from "@clerk/nextjs/server";
import { and, eq } from "drizzle-orm";
import DigestApp from "./DigestApp";
import LandingPage from "./LandingPage";
import { db } from "@/lib/db";
import { invites, teamMembers, teams } from "@/lib/db/schema";

export const dynamic = "force-dynamic";

export default async function Page() {
  const { userId } = await auth();
  if (!userId) return <LandingPage />;

  const membership = await db.query.teamMembers.findFirst({
    where: eq(teamMembers.userId, userId),
    columns: { teamId: true },
  });

  if (!membership) {
    const user = await currentUser();
    const email = user?.emailAddresses
      .find((e) => e.id === user.primaryEmailAddressId)
      ?.emailAddress?.toLowerCase();

    if (email) {
      const pending = await db.query.invites.findFirst({
        where: and(eq(invites.email, email), eq(invites.status, "pending")),
        columns: { id: true },
      });
      if (pending) redirect("/accept-invite?existing=1");
    }

    redirect("/onboarding");
  }

  const team = await db.query.teams.findFirst({
    where: eq(teams.id, membership.teamId),
    columns: { fathomApiKeyEnc: true },
  });

  return (
    <DigestApp
      initialRecipients={[]}
      hasFathomKey={Boolean(team?.fathomApiKeyEnc)}
    />
  );
}
