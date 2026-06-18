import { Fathom } from "fathom-typescript";
import { FathomError } from "fathom-typescript/sdk/models/errors";
import type { Meeting as SdkMeeting } from "fathom-typescript/sdk/models/shared";
import type { Meeting } from "./types";
import { stripMarkdownLinks } from "./markdown";

function client(): Fathom {
  const apiKey = process.env.FATHOM_API_KEY;
  if (!apiKey) {
    throw new Error(
      "FATHOM_API_KEY is not set. Add it to .env.local (see .env.example).",
    );
  }
  return new Fathom({
    security: { apiKeyAuth: apiKey },
    // Without this the SDK makes zero retries and silently treats 429/401
    // responses as an empty page instead of throwing, which masks rate
    // limiting as "no meetings found".
    retryConfig: {
      strategy: "backoff",
      backoff: {
        initialInterval: 500,
        maxInterval: 8_000,
        exponent: 1.5,
        maxElapsedTime: 30_000,
      },
      retryConnectionErrors: true,
    },
  });
}

function mapMeeting(m: SdkMeeting): Meeting {
  return {
    id: String(m.recordingId),
    title: m.title || "Untitled meeting",
    startedAt: m.recordingStartTime ? m.recordingStartTime.toISOString() : null,
    summaryMarkdown: stripMarkdownLinks(m.defaultSummary?.markdownFormatted ?? ""),
    actionItems: (m.actionItems ?? []).map((a) => ({
      description: a.description,
      assignee: a.assignee.name ?? a.assignee.email ?? undefined,
      completed: a.completed,
    })),
    url: m.url,
    shareUrl: m.shareUrl,
  };
}

function rethrow(err: unknown): never {
  if (err instanceof FathomError) {
    if (err.statusCode === 401 || err.statusCode === 403) {
      throw new Error(
        "Fathom rejected the API key (401/403). Check FATHOM_API_KEY and that your plan includes API access.",
      );
    }
    throw new Error(
      `Fathom API error ${err.statusCode}: ${err.body.slice(0, 300) || err.message}`,
    );
  }
  throw err;
}

/**
 * Fetch meetings created in [after, before). Timestamps are ISO 8601 strings.
 * The SDK handles pagination as an async iterable; we drain every page.
 * (Transcripts are intentionally NOT requested.)
 */
export async function listMeetings(
  after: string,
  before: string,
): Promise<Meeting[]> {
  const fathom = client();
  const meetings: Meeting[] = [];

  try {
    const pages = await fathom.listMeetings({
      createdAfter: after,
      createdBefore: before,
      includeSummary: true,
      includeActionItems: true,
    });

    for await (const page of pages) {
      // The SDK represents 400/401/429 responses as `undefined` pages
      // instead of throwing — treat that as a real failure, not "no data".
      if (!page) {
        throw new Error(
          "Fathom API request failed (likely rate limited or unauthorized) while listing meetings.",
        );
      }
      for (const item of page.result.items) {
        meetings.push(mapMeeting(item));
      }
    }
  } catch (err) {
    rethrow(err);
  }

  return meetings;
}
