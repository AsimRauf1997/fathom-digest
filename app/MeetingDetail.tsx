"use client";

import { useMemo, useRef, useState, type ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { Copy, Check, ChevronLeft, ChevronRight, Search } from "lucide-react";
import type { Meeting } from "@/lib/types";
import { markdownToHtmlWithLinks } from "@/lib/markdown";
import { groupBySpeaker, speakerColorIndex, turnsToPlainText } from "@/lib/transcript";
import { fetchTranscript } from "@/lib/api-client";
import { queryKeys } from "@/lib/query-keys";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export default function MeetingDetail({
  meeting,
  open,
  onOpenChange,
}: {
  meeting: Meeting | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const time = meeting?.startedAt
    ? new Date(meeting.startedAt).toLocaleString(undefined, {
        hour: "2-digit",
        minute: "2-digit",
      })
    : "";

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="detail-sheet" side="right">
        {meeting && (
          <>
            <SheetHeader className="detail-head">
              <SheetTitle className="detail-title">{meeting.title}</SheetTitle>
              <SheetDescription className="detail-meta">
                {time && <span>{time}</span>}
                {time && <span className="dot" />}
                <span>ID {meeting.id}</span>
              </SheetDescription>
            </SheetHeader>

            <Tabs defaultValue="summary" className="detail-tabs">
              <TabsList variant="line" className="detail-tabs-list">
                <TabsTrigger value="summary">Summary</TabsTrigger>
                <TabsTrigger value="transcript">Transcript</TabsTrigger>
              </TabsList>

              <TabsContent value="summary" className="detail-tab-panel">
                <SummaryPanel meeting={meeting} />
              </TabsContent>

              <TabsContent value="transcript" className="detail-tab-panel">
                <TranscriptPanel meeting={meeting} />
              </TabsContent>
            </Tabs>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}

function SummaryPanel({ meeting }: { meeting: Meeting }) {
  return (
    <div className="detail-body">
      {meeting.summaryMarkdown && (
        <div
          className="summary-detail"
          dangerouslySetInnerHTML={{
            __html: markdownToHtmlWithLinks(meeting.summaryMarkdown),
          }}
        />
      )}

      {meeting.actionItems.length > 0 && (
        <>
          <div className="label-rule">Action items</div>
          <ul className="actions-list">
            {meeting.actionItems.map((a, i) => (
              <li key={i}>
                {a.description}
                {a.assignee ? <span className="who"> — {a.assignee}</span> : null}
              </li>
            ))}
          </ul>
        </>
      )}

      {!meeting.summaryMarkdown && meeting.actionItems.length === 0 && (
        <p className="muted" style={{ fontSize: 13 }}>
          No summary available for this recording.
        </p>
      )}
    </div>
  );
}

function countOccurrences(text: string, needle: string): number {
  if (!needle) return 0;
  const lower = text.toLowerCase();
  let count = 0;
  let idx = lower.indexOf(needle);
  while (idx !== -1) {
    count++;
    idx = lower.indexOf(needle, idx + needle.length);
  }
  return count;
}

function TranscriptPanel({ meeting }: { meeting: Meeting }) {
  const [query, setQuery] = useState("");
  const [matchIndex, setMatchIndex] = useState(0);
  const [copied, setCopied] = useState(false);
  const matchRefs = useRef<Map<number, HTMLElement>>(new Map());

  const transcriptQuery = useQuery({
    queryKey: queryKeys.transcript(meeting.id),
    queryFn: () => fetchTranscript(meeting.id),
  });

  const turns = useMemo(
    () => groupBySpeaker(transcriptQuery.data ?? []),
    [transcriptQuery.data],
  );

  const recordingUrl = meeting.shareUrl ?? meeting.url ?? null;
  const needle = query.trim().toLowerCase();

  // Global match start-index for every (turn, line), plus the total count —
  // computed together in one pass so rendering never mutates a counter.
  const { matchStartIndices, matchCount } = useMemo(() => {
    const starts: number[][] = [];
    let count = 0;
    for (const turn of turns) {
      const turnStarts: number[] = [];
      for (const line of turn.lines) {
        turnStarts.push(count);
        count += needle ? countOccurrences(line.text, needle) : 0;
      }
      starts.push(turnStarts);
    }
    return { matchStartIndices: starts, matchCount: count };
  }, [turns, needle]);

  const activeMatch = matchCount === 0 ? 0 : ((matchIndex % matchCount) + matchCount) % matchCount;

  const onSearchChange = (value: string) => {
    setQuery(value);
    setMatchIndex(0);
  };

  const jumpTo = (next: number) => {
    if (matchCount === 0) return;
    const idx = ((next % matchCount) + matchCount) % matchCount;
    setMatchIndex(idx);
    matchRefs.current.get(idx)?.scrollIntoView({ block: "center", behavior: "smooth" });
  };

  const copyTranscript = async () => {
    await navigator.clipboard.writeText(turnsToPlainText(turns));
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <div className="detail-body transcript-panel">
      <div className="transcript-toolbar">
        <div className="transcript-search">
          <Search size={14} className="transcript-search-icon" />
          <Input
            type="text"
            placeholder="Search transcript…"
            value={query}
            onChange={(e) => onSearchChange(e.target.value)}
            className="transcript-search-input"
          />
          {needle && (
            <div className="transcript-search-nav">
              <span className="muted" style={{ fontSize: 11 }}>
                {matchCount > 0 ? `${activeMatch + 1} / ${matchCount}` : "0 / 0"}
              </span>
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                disabled={matchCount === 0}
                onClick={() => jumpTo(activeMatch - 1)}
                aria-label="Previous match"
              >
                <ChevronLeft size={14} />
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                disabled={matchCount === 0}
                onClick={() => jumpTo(activeMatch + 1)}
                aria-label="Next match"
              >
                <ChevronRight size={14} />
              </Button>
            </div>
          )}
        </div>

        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={copyTranscript}
          disabled={turns.length === 0}
        >
          {copied ? <Check size={14} /> : <Copy size={14} />}
          {copied ? "Copied" : "Copy"}
        </Button>
      </div>

      <div className="transcript">
        {transcriptQuery.isPending && (
          <p className="muted" style={{ fontSize: 12 }}>
            Loading transcript…
          </p>
        )}
        {transcriptQuery.isError && (
          <p className="muted" style={{ fontSize: 12 }}>
            {transcriptQuery.error instanceof Error
              ? transcriptQuery.error.message
              : "Failed to load transcript."}
          </p>
        )}
        {transcriptQuery.data?.length === 0 && (
          <p className="muted" style={{ fontSize: 12 }}>
            No transcript available for this recording.
          </p>
        )}

        {turns.map((turn, ti) => (
          <div className="turn" key={ti} data-color={speakerColorIndex(turn.speaker)}>
            <div className="turn-head">
              <span className="turn-speaker">{turn.speaker}</span>
              {recordingUrl ? (
                <a
                  className="turn-time"
                  href={recordingUrl}
                  target="_blank"
                  rel="noreferrer noopener"
                >
                  {turn.lines[0].timestamp}
                </a>
              ) : (
                <span className="turn-time">{turn.lines[0].timestamp}</span>
              )}
            </div>
            {turn.lines.map((line, li) => {
              const startIndex = matchStartIndices[ti][li];
              return (
                <p className="turn-line" key={li}>
                  <HighlightedText
                    text={line.text}
                    needle={needle}
                    startIndex={startIndex}
                    activeIndex={activeMatch}
                    registerMatchRef={(idx, el) => {
                      if (el) matchRefs.current.set(idx, el);
                      else matchRefs.current.delete(idx);
                    }}
                  />
                </p>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}

// Splits `text` on every occurrence of `needle` (case-insensitive) and
// wraps each in <mark>, tagging the currently-active one so the toolbar's
// prev/next controls can scroll to it.
function HighlightedText({
  text,
  needle,
  startIndex,
  activeIndex,
  registerMatchRef,
}: {
  text: string;
  needle: string;
  startIndex: number;
  activeIndex: number;
  registerMatchRef: (globalIndex: number, el: HTMLElement | null) => void;
}): ReactNode {
  if (!needle) return text;

  const lower = text.toLowerCase();
  const parts: ReactNode[] = [];
  let cursor = 0;
  let occurrence = 0;
  let idx = lower.indexOf(needle, cursor);

  if (idx === -1) return text;

  while (idx !== -1) {
    if (idx > cursor) parts.push(text.slice(cursor, idx));
    const globalIndex = startIndex + occurrence;
    parts.push(
      <mark
        key={idx}
        ref={(el) => registerMatchRef(globalIndex, el)}
        data-active={globalIndex === activeIndex ? "true" : undefined}
      >
        {text.slice(idx, idx + needle.length)}
      </mark>,
    );
    cursor = idx + needle.length;
    occurrence++;
    idx = lower.indexOf(needle, cursor);
  }
  if (cursor < text.length) parts.push(text.slice(cursor));

  return parts;
}
