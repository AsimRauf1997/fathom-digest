import {
  Body,
  Container,
  Head,
  Heading,
  Hr,
  Html,
  Preview,
  Section,
  Text,
} from "@react-email/components";
import * as React from "react";
import type { Meeting } from "../lib/types";
import { markdownToHtml } from "../lib/markdown";

export interface MeetingDigestProps {
  label: string;
  intro?: string;
  meetings: Meeting[];
}

const ACCENT = "#c03a22";
const INK = "#1a1712";
const INK_SOFT = "#4c463a";
const INK_FAINT = "#8a8270";
const RULE = "#ddd2bb";
const RULE_STRONG = "#cabd9f";
const PAPER = "#ece4d4";
const CARD = "#faf6ec";

const serif = 'Georgia, "Times New Roman", serif';
const sans =
  '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif';

function formatTime(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "";
  return d.toLocaleString("en-US", {
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function MeetingDigest({
  label,
  intro,
  meetings,
}: MeetingDigestProps) {
  const previewText =
    meetings.length > 0
      ? `${meetings.length} meeting${meetings.length === 1 ? "" : "s"} — ${label}`
      : `Meeting notes — ${label}`;

  return (
    <Html>
      <Head />
      <Preview>{previewText}</Preview>
      <Body
        style={{
          backgroundColor: PAPER,
          margin: 0,
          padding: "28px 0",
          fontFamily: sans,
          color: INK,
        }}
      >
        <Container
          style={{
            maxWidth: "640px",
            margin: "0 auto",
            backgroundColor: CARD,
            border: `1px solid ${RULE_STRONG}`,
            borderRadius: "6px",
            overflow: "hidden",
          }}
        >
          {/* Masthead */}
          <Section
            style={{
              borderTop: `5px solid ${INK}`,
              padding: "24px 32px 18px",
              textAlign: "center",
            }}
          >
            <Text
              style={{
                margin: 0,
                fontSize: "10.5px",
                letterSpacing: "0.18em",
                textTransform: "uppercase",
                color: INK_FAINT,
                fontFamily: sans,
              }}
            >
              Fathom Digest
            </Text>
            <Heading
              as="h1"
              style={{
                margin: "8px 0 0",
                fontFamily: serif,
                fontSize: "34px",
                lineHeight: 1.05,
                letterSpacing: "-0.01em",
                color: INK,
                fontWeight: 700,
              }}
            >
              Meeting notes
            </Heading>
            <Text
              style={{
                margin: "10px 0 0",
                fontFamily: serif,
                fontStyle: "italic",
                fontSize: "15px",
                color: INK_SOFT,
              }}
            >
              ✦&nbsp;&nbsp;{label}&nbsp;&nbsp;✦
            </Text>
          </Section>

          <Hr
            style={{
              borderColor: INK,
              borderTopWidth: "1px",
              margin: 0,
            }}
          />

          {/* Optional intro note */}
          {intro && intro.trim() ? (
            <Section style={{ padding: "18px 32px 0" }}>
              <Text
                style={{
                  margin: 0,
                  fontSize: "15px",
                  lineHeight: 1.6,
                  color: INK_SOFT,
                  whiteSpace: "pre-wrap",
                }}
              >
                {intro}
              </Text>
            </Section>
          ) : null}

          {/* Meetings */}
          <Section style={{ padding: "8px 32px 24px" }}>
            {meetings.length === 0 ? (
              <Text
                style={{
                  fontFamily: serif,
                  fontStyle: "italic",
                  color: "#8a8270",
                  fontSize: "16px",
                }}
              >
                No meetings found for {label}.
              </Text>
            ) : (
              meetings.map((m, i) => (
                <Section
                  key={m.id}
                  style={{
                    paddingTop: i === 0 ? "16px" : "20px",
                    borderTop: i === 0 ? "none" : `1px solid ${RULE}`,
                    marginTop: i === 0 ? 0 : "20px",
                  }}
                >
                  <Text
                    style={{
                      margin: 0,
                      fontFamily: "monospace",
                      fontSize: "11px",
                      letterSpacing: "0.1em",
                      color: ACCENT,
                    }}
                  >
                    {String(i + 1).padStart(2, "0")}
                  </Text>
                  <Heading
                    as="h2"
                    style={{
                      margin: "2px 0 4px",
                      fontFamily: serif,
                      fontSize: "21px",
                      lineHeight: 1.15,
                      color: INK,
                      fontWeight: 700,
                    }}
                  >
                    {m.title}
                  </Heading>
                  {formatTime(m.startedAt) ? (
                    <Text
                      style={{
                        margin: "0 0 10px",
                        fontFamily: "monospace",
                        fontSize: "11px",
                        letterSpacing: "0.06em",
                        textTransform: "uppercase",
                        color: "#8a8270",
                      }}
                    >
                      {formatTime(m.startedAt)}
                    </Text>
                  ) : null}

                  {m.summaryMarkdown ? (
                    <div
                      style={{
                        fontFamily: sans,
                        fontSize: "14.5px",
                        lineHeight: 1.6,
                        color: INK_SOFT,
                      }}
                      dangerouslySetInnerHTML={{
                        __html: markdownToHtml(m.summaryMarkdown),
                      }}
                    />
                  ) : null}

                  {m.actionItems.length > 0 ? (
                    <>
                      <Text
                        style={{
                          margin: "18px 0 8px",
                          fontFamily: "monospace",
                          fontSize: "10px",
                          letterSpacing: "0.18em",
                          textTransform: "uppercase",
                          color: ACCENT,
                          fontWeight: 700,
                        }}
                      >
                        Action items
                      </Text>
                      <ul style={{ margin: 0, paddingLeft: "18px" }}>
                        {m.actionItems.map((a, idx) => (
                          <li
                            key={idx}
                            style={{
                              fontSize: "14.5px",
                              lineHeight: 1.55,
                              color: INK,
                              marginBottom: "4px",
                            }}
                          >
                            {a.description}
                            {a.assignee ? (
                              <span style={{ color: "#8a8270" }}>
                                {" "}
                                — {a.assignee}
                              </span>
                            ) : null}
                          </li>
                        ))}
                      </ul>
                    </>
                  ) : null}
                </Section>
              ))
            )}
          </Section>

          <Hr style={{ borderColor: RULE, margin: 0 }} />
          <Section style={{ padding: "16px 32px", textAlign: "center" }}>
            <Text
              style={{
                margin: 0,
                fontSize: "10.5px",
                letterSpacing: "0.14em",
                textTransform: "uppercase",
                color: INK_FAINT,
                fontFamily: "monospace",
              }}
            >
              Sent via Fathom Digest
            </Text>
          </Section>
        </Container>
      </Body>
    </Html>
  );
}

// Sample data so `npm run email` (preview server) renders the template.
MeetingDigest.PreviewProps = {
  label: "Tuesday, June 16, 2026",
  intro: "Quick recap from today's standups — full notes below.",
  meetings: [
    {
      id: "155469023",
      title: "Impromptu Microsoft Teams Meeting",
      startedAt: "2026-06-16T14:43:35Z",
      summaryMarkdown:
        "## Meeting Purpose\n\nReviewing pipeline features and aligning on currency and KPI logic.\n\n## Key Takeaways\n\n- **Currency Logic:** Honorariums default to the project's currency (or USD if undefined).\n- **Pipeline Security:** Ops can no longer edit employment details once a profile is in review.",
      actionItems: [
        { description: "Revert the Wise integration currency update", assignee: "Asim" },
        { description: "Validate the KPI dashboard against production data" },
      ],
      url: "https://fathom.video/calls/155469023",
      shareUrl: "https://fathom.video/share/155469023",
    },
  ],
} satisfies MeetingDigestProps;
