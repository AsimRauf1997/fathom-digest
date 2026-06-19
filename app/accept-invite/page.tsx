import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { AcceptInviteForm } from "@/components/auth/accept-invite-form";
import { AcceptInviteExistingForm } from "@/components/auth/accept-invite-existing-form";
import { AuthShell } from "@/components/auth/AuthShell";

export const dynamic = "force-dynamic";

export default async function AcceptInvitePage({
  searchParams,
}: {
  searchParams: Promise<{ existing?: string }>;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const params = await searchParams;
  const isExistingUser = params.existing === "1";

  if (isExistingUser) {
    return (
      <AuthShell
        eyebrow="Welcome back"
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

  return (
    <AuthShell
      eyebrow="Welcome to your team"
      headline={
        <>
          Set a password to <em>get started.</em>
        </>
      }
      tagline="You've been invited to join a team. Create a password to access your team's meeting digests."
    >
      <div className="auth-card-head">
        <span className="auth-eyebrow">Accept invite</span>
        <h1>Set your password</h1>
        <p>Create a password for your account.</p>
      </div>

      <AcceptInviteForm />
    </AuthShell>
  );
}
