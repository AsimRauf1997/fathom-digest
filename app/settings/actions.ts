"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCurrentTeamContext, type TeamContext } from "@/lib/team-context";
import type { ActionState } from "@/lib/action-state";
import { sendEmail } from "@/lib/mailer";
import { renderTeamInviteEmail } from "@/lib/render-email";

async function requireAdminContext(): Promise<
  { ctx: TeamContext } | { error: string }
> {
  const ctx = await getCurrentTeamContext();
  if (!ctx) return { error: "Not signed in or no team." };
  if (ctx.role !== "admin") return { error: "Only team admins can do this." };
  return { ctx };
}

export async function updateFathomKey(
  _prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const result = await requireAdminContext();
  if ("error" in result) return { error: result.error };

  const fathomKey = (formData.get("fathomKey") as string)?.trim();
  if (!fathomKey) return { error: "Fathom API key cannot be empty." };

  const admin = createAdminClient();
  const { error } = await admin.rpc("set_team_fathom_key", {
    p_team_id: result.ctx.teamId,
    p_plaintext_key: fathomKey,
    p_passphrase: process.env.SUPABASE_DB_ENCRYPTION_KEY,
  });
  if (error) return { error: error.message };

  revalidatePath("/settings");
  revalidatePath("/");
  return null;
}

export async function inviteMember(
  _prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const result = await requireAdminContext();
  if ("error" in result) return { error: result.error };

  const email = (formData.get("email") as string)?.trim().toLowerCase();
  if (!email) return { error: "Email is required." };

  const admin = createAdminClient();

  const { data: existingInvite } = await admin
    .from("invites")
    .select("id")
    .eq("team_id", result.ctx.teamId)
    .eq("email", email)
    .eq("status", "pending")
    .maybeSingle();
  if (existingInvite) {
    return { error: "This email already has a pending invite." };
  }

  let userId: string;
  const { data: inviteData, error: inviteError } =
    await admin.auth.admin.inviteUserByEmail(email, {
      redirectTo: `${process.env.NEXT_PUBLIC_SITE_URL ?? ""}/auth/callback`,
    });

  if (inviteError) {
    if (!/already.*registered/i.test(inviteError.message)) {
      return { error: inviteError.message };
    }

    const { data: listed, error: listError } =
      await admin.auth.admin.listUsers();
    if (listError) return { error: listError.message };

    const existingUser = listed.users.find(
      (u) => u.email?.toLowerCase() === email,
    );
    if (!existingUser) {
      return { error: "Could not find the existing account for that email." };
    }
    userId = existingUser.id;

    // Generate a magic link and send a team invite email for the existing user
    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "";
    const { data: linkData, error: linkError } =
      await admin.auth.admin.generateLink({
        type: "magiclink",
        email,
        options: { redirectTo: `${siteUrl}/auth/callback` },
      });

    if (linkError) {
      return {
        error: `Could not generate sign-in link: ${linkError.message}`,
      };
    }

    const acceptUrl = linkData?.properties?.action_link;
    if (!acceptUrl) {
      return { error: "Could not generate sign-in link." };
    }

    // Get the team name for the email
    const { data: team } = await admin
      .from("teams")
      .select("name")
      .eq("id", result.ctx.teamId)
      .single();

    const teamName = team?.name ?? "your team";
    const inviterUser = await createClient().auth.getUser();
    const inviterEmail = inviterUser.data?.user?.email ?? "a team admin";

    // Render and send the team invite email
    try {
      const { subject, html, text } = await renderTeamInviteEmail({
        teamName,
        inviterEmail,
        acceptUrl,
      });

      await sendEmail({
        to: [email],
        subject,
        html,
        text,
      });
    } catch (emailError) {
      // Log the error but don't fail the invite if email fails
      console.error("Failed to send team invite email:", emailError);
    }
  } else {
    if (!inviteData.user) return { error: "Invite did not return a user." };
    userId = inviteData.user.id;
  }

  const { error: inviteRowError } = await admin.from("invites").insert({
    team_id: result.ctx.teamId,
    email,
    invited_by: result.ctx.userId,
    invited_user_id: userId,
    status: "pending",
  });
  if (inviteRowError) return { error: inviteRowError.message };

  revalidatePath("/settings");
  return null;
}

export async function resendInvite(
  _prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const result = await requireAdminContext();
  if ("error" in result) return { error: result.error };

  const inviteId = formData.get("inviteId") as string;
  if (!inviteId) return { error: "Missing invite ID." };

  const admin = createAdminClient();
  const { data: invite } = await admin
    .from("invites")
    .select("email, team_id")
    .eq("id", inviteId)
    .single();

  if (!invite) return { error: "Invite not found." };
  if (invite.team_id !== result.ctx.teamId) {
    return { error: "Not authorized to resend this invite." };
  }

  const { error: resetError } = await admin.auth.resetPasswordForEmail(
    invite.email,
    {
      redirectTo: `${process.env.NEXT_PUBLIC_SITE_URL ?? ""}/auth/callback`,
    },
  );
  if (resetError) return { error: resetError.message };

  revalidatePath("/settings");
  return null;
}

export async function updateMemberRole(
  _prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const result = await requireAdminContext();
  if ("error" in result) return { error: result.error };

  const memberId = formData.get("memberId") as string;
  const role = formData.get("role") as "admin" | "member";
  if (!memberId || !role) return { error: "Missing member or role." };

  if (role === "member") {
    const supabase = await createClient();
    const { data: member } = await supabase
      .from("team_members")
      .select("user_id")
      .eq("id", memberId)
      .single();

    if (member) {
      const { data: remainingAdmins } = await supabase
        .from("team_members")
        .select("id")
        .eq("team_id", result.ctx.teamId)
        .eq("role", "admin");

      if (remainingAdmins && remainingAdmins.length === 1) {
        return { error: "Cannot remove the last admin." };
      }
    }
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("team_members")
    .update({ role })
    .eq("id", memberId);
  if (error) return { error: error.message };

  revalidatePath("/settings");
  return null;
}

export async function removeMember(
  _prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const result = await requireAdminContext();
  if ("error" in result) return { error: result.error };

  const memberId = formData.get("memberId") as string;
  if (!memberId) return { error: "Missing member." };

  const supabase = await createClient();
  const { data: member } = await supabase
    .from("team_members")
    .select("role")
    .eq("id", memberId)
    .single();

  if (member?.role === "admin") {
    const { data: remainingAdmins } = await supabase
      .from("team_members")
      .select("id")
      .eq("team_id", result.ctx.teamId)
      .eq("role", "admin");

    if (remainingAdmins && remainingAdmins.length === 1) {
      return { error: "Cannot remove the last admin." };
    }
  }

  const { error } = await supabase.from("team_members").delete().eq("id", memberId);
  if (error) return { error: error.message };

  revalidatePath("/settings");
  return null;
}
