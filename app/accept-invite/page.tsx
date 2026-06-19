import { redirect } from "next/navigation";
import { auth } from "@clerk/nextjs/server";
import { AcceptInviteExistingForm } from "@/components/auth/accept-invite-existing-form";
import { AuthShell } from "@/components/auth/AuthShell";

export const dynamic = "force-dynamic";

export default async function AcceptInvitePage({
  searchParams,
}: {
  searchParams: Promise<{ existing?: string }>;
}) {
  const { userId } = await auth();
  if (!userId) {
    redirect("/login");
  }

  const params = await searchParams;
  void params.existing;

  return (
    <AuthShell
      eyebrow="Welcome"
      headline={
        <>
          Join your <em>new team.</em>
        </>
      }
      tagline="You've been invited to join a team on Fathom Digest."
    >
      <div className="auth-card-head">
        <span className="auth-eyebrow">Accept invite</span>
        <h1>Join team</h1>
        <p>Click below to join your team and access meeting digests.</p>
      </div>

      <AcceptInviteExistingForm />
    </AuthShell>
  );
}
