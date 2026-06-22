"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useMutation, useQuery } from "@tanstack/react-query";
import type { Meeting } from "@/lib/types";
import AppHeader from "./AppHeader";
import AppFooter from "./AppFooter";
import DatePicker from "./DatePicker";
import MeetingDetail from "./MeetingDetail";
import { excerptFromMarkdown } from "@/lib/markdown";
import {
  fetchMeetingsByDate,
  renderPreview,
  sendDigest,
} from "@/lib/api-client";
import { queryKeys } from "@/lib/query-keys";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Alert } from "@/components/ui/alert";
import { Skeleton } from "@/components/ui/skeleton";

// Digest drafting & sending is paused for every role while the flow gets
// reworked. Flip this back on to restore the compose column for admins.
const DIGEST_SENDING_ENABLED = false;

function todayStr(): string {
  const d = new Date();
  const tz = d.getTimezoneOffset() * 60000;
  return new Date(d.getTime() - tz).toISOString().slice(0, 10);
}

function longDate(d: string): string {
  const dt = new Date(`${d}T00:00:00`);
  if (isNaN(dt.getTime())) return d;
  return dt.toLocaleDateString(undefined, {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

type Status =
  | { kind: "idle" }
  | { kind: "info"; msg: string }
  | { kind: "ok"; msg: string }
  | { kind: "err"; msg: string };

export default function DigestApp({
  initialRecipients,
  hasFathomKey,
  role,
}: {
  initialRecipients: string[];
  hasFathomKey: boolean;
  role: "admin" | "member";
}) {
  const showCompose = DIGEST_SENDING_ENABLED && role === "admin";

  const [date, setDate] = useState(todayStr());
  const [submittedDate, setSubmittedDate] = useState(todayStr());

  const [subject, setSubject] = useState("");
  const [intro, setIntro] = useState("");
  const [previewHtml, setPreviewHtml] = useState("");

  const [recipients, setRecipients] = useState<string[]>(
    initialRecipients.length > 0 ? initialRecipients : [""],
  );
  const [status, setStatus] = useState<Status>({ kind: "idle" });
  const [openMeetingId, setOpenMeetingId] = useState<string | null>(null);

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const label = longDate(submittedDate);

  const meetingsQuery = useQuery({
    queryKey: queryKeys.meetingsByDate(submittedDate),
    queryFn: () => fetchMeetingsByDate(submittedDate),
  });

  const previewMutation = useMutation({
    mutationFn: renderPreview,
    onSuccess: (data) => {
      setPreviewHtml(data.html);
      setSubject((s) => s || data.subject);
    },
    onError: (err) => {
      setStatus({
        kind: "err",
        msg: err instanceof Error ? err.message : "Preview failed",
      });
    },
  });

  const sendMutation = useMutation({
    mutationFn: sendDigest,
    onSuccess: (_data, variables) => {
      setStatus({ kind: "ok", msg: `Sent to ${variables.recipients.join(", ")}` });
    },
    onError: (err) => {
      setStatus({
        kind: "err",
        msg: err instanceof Error ? err.message : "Failed to send",
      });
    },
  });

  // Reset subject/preview whenever a new fetch is committed.
  useEffect(() => {
    setSubject(`Meeting notes — ${label}`);
    setPreviewHtml("");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [submittedDate]);

  // Mirror load results (error / empty / loaded) into the status bar, and
  // kick off a fresh preview render once meetings come back — only when
  // there's a compose panel around to show that preview.
  useEffect(() => {
    if (meetingsQuery.isError) {
      setStatus({
        kind: "err",
        msg:
          meetingsQuery.error instanceof Error
            ? meetingsQuery.error.message
            : "Failed to load meetings",
      });
      return;
    }
    if (meetingsQuery.data) {
      if (meetingsQuery.data.length === 0) {
        setStatus({ kind: "info", msg: `No meetings found for ${label}.` });
      } else {
        setStatus({ kind: "idle" });
        if (showCompose) {
          previewMutation.mutate({ label, meetings: meetingsQuery.data, intro });
        }
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [meetingsQuery.isError, meetingsQuery.error, meetingsQuery.data, label, showCompose]);

  const submit = () => {
    setSubmittedDate(date);
  };

  // Debounced live preview when the intro note changes.
  const onIntroChange = (value: string) => {
    setIntro(value);
    const meetings = meetingsQuery.data;
    if (!meetings || meetings.length === 0) return;
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      previewMutation.mutate({ label, meetings, intro: value });
    }, 500);
  };

  const send = () => {
    const to = recipients.map((r) => r.trim()).filter(Boolean);
    const meetings = meetingsQuery.data;
    if (to.length === 0) {
      setStatus({ kind: "err", msg: "Add at least one recipient." });
      return;
    }
    if (!meetings || meetings.length === 0) {
      setStatus({ kind: "err", msg: "Load some meetings first." });
      return;
    }
    setStatus({ kind: "info", msg: "Sending digest…" });
    sendMutation.mutate({ recipients: to, subject, label, meetings, intro });
  };

  const loading = meetingsQuery.isPending || meetingsQuery.isFetching;
  const meetings = meetingsQuery.data ?? null;
  const recipientCount = recipients.filter((r) => r.trim()).length;
  const today = todayStr();

  const meetingsCount = meetings?.length ?? 0;
  const actionItemsCount =
    meetings?.reduce((sum, m) => sum + m.actionItems.length, 0) ?? 0;
  const kicker = submittedDate === today ? "Today’s notes" : "Archive edition";
  const openMeeting = meetings?.find((m) => m.id === openMeetingId) ?? null;

  return (
    <div className="wrap">
      <AppHeader />

      {!hasFathomKey && (
        <Alert variant="err" className="mb-4">
          No Fathom API key is configured for your team.{" "}
          <Link href="/settings">Add one in Settings</Link> to start fetching
          meetings.
        </Alert>
      )}

      <div className="edition-bar">
        <div className="edition-id">
          <span className="kicker">{kicker}</span>
          <h1 className="edition-headline">{label}</h1>
        </div>

        <div className="sourcebar">
          <div className="source-field">
            <Label>Date</Label>
            <div className="dateline">
              <DatePicker
                value={date}
                onChange={setDate}
                max={today}
                onEnter={submit}
                joined
              />
              <span className="dateline-rule" aria-hidden />
              <Button
                type="button"
                variant="primary"
                className="dateline-fetch"
                onClick={submit}
                disabled={loading}
              >
                {loading ? <span className="spinner" /> : null}
                {loading ? "Fetching" : "Fetch"}
              </Button>
            </div>
          </div>
        </div>
      </div>

      {showCompose ? (
        <div className="columns">
          {/* Left: meetings */}
          <section>
            <MeetingsFeed
              loading={loading}
              meetings={meetings}
              label={label}
              onOpen={(m) => setOpenMeetingId(m.id)}
            />
          </section>

          {/* Right: compose */}
          <section className="compose">
            <div className="col-head">
              <h2>Compose</h2>
              <span className="count">Compose &amp; send</span>
            </div>

            <div className="panel">
              <div className="stack">
                <Label>Recipients</Label>
                <div className="recipients">
                  {recipients.map((r, i) => (
                    <div className="recipient-row" key={i}>
                      <Input
                        type="text"
                        className="font-mono text-[13px]"
                        placeholder="name@example.com"
                        value={r}
                        onChange={(e) => {
                          const next = [...recipients];
                          next[i] = e.target.value;
                          setRecipients(next);
                        }}
                      />
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() =>
                          setRecipients(
                            recipients.length === 1
                              ? [""]
                              : recipients.filter((_, idx) => idx !== i),
                          )
                        }
                        aria-label="Remove recipient"
                      >
                        ✕
                      </Button>
                    </div>
                  ))}
                </div>
                <div style={{ marginTop: 8 }}>
                  <Button
                    variant="ghost"
                    onClick={() => setRecipients([...recipients, ""])}
                  >
                    + Add
                  </Button>
                </div>
              </div>

              <div className="stack">
                <Label>Subject</Label>
                <Input
                  type="text"
                  className="w-full"
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                />
              </div>

              <div className="stack">
                <Label>Intro note (optional)</Label>
                <Textarea
                  placeholder="Add a short note at the top of the email…"
                  value={intro}
                  onChange={(e) => onIntroChange(e.target.value)}
                />
              </div>

              <div className="stack">
                <div className="preview-head">
                  <Label style={{ margin: 0 }}>Email preview</Label>
                  {previewMutation.isPending && (
                    <span className="muted" style={{ fontSize: 11 }}>
                      <span className="spinner" />
                      rendering
                    </span>
                  )}
                </div>
                {previewHtml ? (
                  <iframe
                    title="Email preview"
                    srcDoc={previewHtml}
                    className="preview-frame"
                  />
                ) : (
                  <div className="preview-empty">
                    <span>No preview yet.</span>
                    <span className="muted" style={{ fontSize: 12 }}>
                      Load meetings to render the email.
                    </span>
                  </div>
                )}
              </div>

              <div className="send-row">
                <Button
                  variant="primary"
                  size="primary"
                  onClick={send}
                  disabled={sendMutation.isPending || !meetings || meetings.length === 0}
                >
                  {sendMutation.isPending ? <span className="spinner" /> : null}
                  {sendMutation.isPending ? "Sending" : "Send digest"}
                </Button>
                <span className="muted" style={{ fontSize: 12 }}>
                  {recipientCount} recipient{recipientCount === 1 ? "" : "s"}
                </span>
              </div>

              {status.kind !== "idle" && (
                <Alert variant={status.kind} className="mt-4">
                  {status.msg}
                </Alert>
              )}
            </div>
          </section>
        </div>
      ) : (
        <div className="dash-grid">
          <section className="dash-main">
            <MeetingsFeed
              loading={loading}
              meetings={meetings}
              label={label}
              onOpen={(m) => setOpenMeetingId(m.id)}
            />
          </section>

          <aside className="dash-rail sidebar-stats">
            <div className="stats-head">Edition stats</div>

            <div className="stat">
              <span className="stat-num">
                {meetingsCount}
                <span className="unit">logged</span>
              </span>
              <span className="stat-label">Meetings captured for {label}</span>
            </div>

            <div className="stat">
              <span className="stat-num">
                {actionItemsCount}
                <span className="unit">open</span>
              </span>
              <span className="stat-label">
                Action items pulled from summaries
              </span>
            </div>

            <div className="paused-note">
              <strong>Sending is paused</strong>
              Digest drafting and email delivery are offline for everyone —
              admins included — while we rework the flow. Browse summaries
              and full transcripts below in the meantime.
            </div>
          </aside>
        </div>
      )}

      <AppFooter date={longDate(today)} />

      <MeetingDetail
        meeting={openMeeting}
        open={openMeetingId !== null}
        onOpenChange={(next) => {
          if (!next) setOpenMeetingId(null);
        }}
      />
    </div>
  );
}

function MeetingsFeed({
  loading,
  meetings,
  label,
  onOpen,
}: {
  loading: boolean;
  meetings: Meeting[] | null;
  label: string;
  onOpen: (meeting: Meeting) => void;
}) {
  return (
    <>
      <div className="col-head">
        <h2>Meetings</h2>
        <span className="count">
          {meetings
            ? `${meetings.length} item${meetings.length === 1 ? "" : "s"}`
            : "—"}
        </span>
      </div>

      {loading && (
        <div aria-hidden>
          <SkeletonEntry />
          <SkeletonEntry />
        </div>
      )}

      {!loading && !meetings && (
        <p className="empty">
          Pick a date and fetch to begin.
          <span className="small">
            Today’s meetings load automatically.
          </span>
        </p>
      )}

      {!loading && meetings && meetings.length === 0 && (
        <p className="empty">
          No meetings for {label}.
          <span className="small">Try another date.</span>
        </p>
      )}

      {meetings?.map((m, i) => (
        <MeetingEntry key={m.id} meeting={m} index={i} onOpen={() => onOpen(m)} />
      ))}
    </>
  );
}

function SkeletonEntry() {
  return (
    <div className="skeleton">
      <Skeleton className="mb-[18px] h-[9px] w-[38%]" />
      <Skeleton className="mb-3.5 h-[22px] w-[62%]" />
      <Skeleton className="w-[90%]" />
      <Skeleton className="w-[80%]" />
      <Skeleton className="mb-0 w-[70%]" />
    </div>
  );
}

function MeetingEntry({
  meeting,
  index,
  onOpen,
}: {
  meeting: Meeting;
  index: number;
  onOpen: () => void;
}) {
  const time = meeting.startedAt
    ? new Date(meeting.startedAt).toLocaleString(undefined, {
        hour: "2-digit",
        minute: "2-digit",
      })
    : "";
  const excerpt = excerptFromMarkdown(meeting.summaryMarkdown);
  const actionCount = meeting.actionItems.length;

  return (
    <article
      className="entry entry-compact"
      style={{ animationDelay: `${Math.min(index * 60, 360)}ms` }}
    >
      <button type="button" className="entry-open" onClick={onOpen}>
        <span className="num">No. {String(index + 1).padStart(2, "0")}</span>
        <h3>{meeting.title}</h3>
        <div className="meta">
          {time && <span>{time}</span>}
          {time && <span className="dot" />}
          <span>ID {meeting.id}</span>
          {actionCount > 0 && (
            <span className="chip-actions">
              {actionCount} open
            </span>
          )}
        </div>
        {excerpt && <p className="excerpt">{excerpt}</p>}
      </button>
    </article>
  );
}
