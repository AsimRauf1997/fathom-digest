import type { Meeting } from "./types";

async function asJson<T>(res: Response): Promise<T> {
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "Request failed");
  return data as T;
}

export async function fetchMeetingsByDate(date: string): Promise<Meeting[]> {
  const res = await fetch(`/api/meetings?date=${date}`);
  const data = await asJson<{ meetings: Meeting[] }>(res);
  return data.meetings;
}

export interface RenderPreviewInput {
  label: string;
  meetings: Meeting[];
  intro?: string;
}

export async function renderPreview(
  input: RenderPreviewInput,
): Promise<{ subject: string; html: string }> {
  const res = await fetch("/api/preview", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  return asJson(res);
}

export interface SendDigestInput {
  recipients: string[];
  subject: string;
  label: string;
  meetings: Meeting[];
  intro?: string;
}

export async function sendDigest(
  input: SendDigestInput,
): Promise<{ ok: true; sentTo: string[] }> {
  const res = await fetch("/api/send", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  return asJson(res);
}
