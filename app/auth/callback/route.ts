import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

async function hasPendingInvite(email: string): Promise<boolean> {
  const admin = createAdminClient();
  const { data } = await admin
    .from("invites")
    .select("id")
    .eq("email", email.toLowerCase())
    .eq("status", "pending")
    .maybeSingle();
  return !!data;
}

/**
 * Lands here from both the OAuth redirect (PKCE `code`) and Supabase's
 * invite/magic-link email (`token_hash` + `type`). Whichever flow applies,
 * establish the session then hand off to middleware to route the user to
 * `/onboarding` (no team yet), `/accept-invite` (has a pending team invite),
 * or `/` (already a team member).
 */
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const tokenHash = searchParams.get("token_hash");
  const type = searchParams.get("type");

  const supabase = await createClient();

  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (error) {
      return NextResponse.redirect(`${origin}/login?error=${encodeURIComponent(error.message)}`);
    }
  } else if (tokenHash && type) {
    const { error } = await supabase.auth.verifyOtp({
      token_hash: tokenHash,
      type: type as "invite" | "magiclink" | "email",
    });
    if (error) {
      return NextResponse.redirect(`${origin}/login?error=${encodeURIComponent(error.message)}`);
    }
    if (type === "invite") {
      return NextResponse.redirect(`${origin}/accept-invite`);
    }
  }

  // After session is established, check if the signed-in user has a pending invite.
  // This handles existing users being re-invited via magic link.
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (user?.email && (await hasPendingInvite(user.email))) {
    return NextResponse.redirect(`${origin}/accept-invite?existing=1`);
  }

  return NextResponse.redirect(`${origin}/`);
}
