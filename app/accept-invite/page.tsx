import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { AcceptInviteForm } from "@/components/auth/accept-invite-form";
import { AuthShell } from "@/components/auth/AuthShell";

export const dynamic = "force-dynamic";

export default async function AcceptInvitePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
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
