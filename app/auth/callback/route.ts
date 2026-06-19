import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

/**
 * Lands here from both the OAuth redirect (PKCE `code`) and Supabase's
 * invite/magic-link email (`token_hash` + `type`). Whichever flow applies,
 * establish the session then hand off to middleware to route the user to
 * `/onboarding` (no team yet) or `/` (already a team member, e.g. invited).
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

  return NextResponse.redirect(`${origin}/`);
}
