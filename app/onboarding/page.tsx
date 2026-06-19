import { redirect } from "next/navigation";
import { auth } from "@clerk/nextjs/server";
import { eq } from "drizzle-orm";
import { AuthShell } from "@/components/auth/AuthShell";
import { CreateTeamForm } from "@/components/onboarding/create-team-form";
import { db } from "@/lib/db";
import { teamMembers } from "@/lib/db/schema";

export const dynamic = "force-dynamic";

export default async function OnboardingPage() {
  const { userId } = await auth();
  if (!userId) {
    redirect("/login");
  }

  const membership = await db.query.teamMembers.findFirst({
    where: eq(teamMembers.userId, userId),
    columns: { teamId: true },
  });
  if (membership) {
    redirect("/");
  }

  return (
    <AuthShell
      eyebrow="Final step"
      headline={
        <>
          One workspace for <em>the whole team&apos;s recordings.</em>
        </>
      }
      tagline="Create a shared digest workspace, connect Fathom once, and every teammate you invite reads from the same feed."
    >
      <div className="auth-card-head">
        <span className="auth-eyebrow">Create your team</span>
        <h1>Set up your workspace</h1>
        <p>You&apos;ll be the team admin — invite others from Settings anytime.</p>
      </div>

      <CreateTeamForm />

      <p className="auth-foot">
        Wrong account? <a href="/login">Sign in with a different one</a>
      </p>
    </AuthShell>
  );
}
