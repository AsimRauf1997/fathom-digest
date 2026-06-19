import { render } from "@react-email/render";
import * as React from "react";
import type { Meeting } from "./types";
import MeetingDigest from "../emails/MeetingDigest";
import TeamInvite from "../emails/TeamInvite";

export function defaultSubject(label: string): string {
  return `Meeting notes — ${label}`;
}

export interface RenderInput {
  label: string;
  meetings: Meeting[];
  intro?: string;
}

/**
 * Renders the React Email template to both HTML (for the email + preview) and a
 * plain-text fallback (for deliverability). This is the single source of truth
 * for the email body — the same render is used by the preview and the send route.
 */
export async function renderDigestEmail({
  label,
  meetings,
  intro,
}: RenderInput): Promise<{ subject: string; html: string; text: string }> {
  const element = (
    <MeetingDigest label={label} meetings={meetings} intro={intro} />
  );
  const [html, text] = await Promise.all([
    render(element),
    render(element, { plainText: true }),
  ]);
  return { subject: defaultSubject(label), html, text };
}

export interface RenderTeamInviteInput {
  teamName: string;
  inviterEmail: string;
  acceptUrl: string;
}

export async function renderTeamInviteEmail({
  teamName,
  inviterEmail,
  acceptUrl,
}: RenderTeamInviteInput): Promise<{ subject: string; html: string; text: string }> {
  const element = (
    <TeamInvite
      teamName={teamName}
      inviterEmail={inviterEmail}
      acceptUrl={acceptUrl}
    />
  );
  const [html, text] = await Promise.all([
    render(element),
    render(element, { plainText: true }),
  ]);
  return {
    subject: `You've been invited to join ${teamName}`,
    html,
    text,
  };
}
