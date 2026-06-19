import {
  Body,
  Button,
  Container,
  Head,
  Html,
  Preview,
  Section,
  Text,
} from "@react-email/components";
import * as React from "react";

export interface TeamInviteProps {
  teamName: string;
  inviterEmail: string;
  acceptUrl: string;
}

const ACCENT = "#c03a22";
const INK = "#1a1712";
const INK_SOFT = "#4c463a";
const PAPER = "#ece4d4";
const CARD = "#faf6ec";

const sans =
  '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif';

export default function TeamInvite({
  teamName,
  inviterEmail,
  acceptUrl,
}: TeamInviteProps) {
  return (
    <Html>
      <Head />
      <Preview>You&apos;re invited to join {teamName}</Preview>
      <Body style={{ fontFamily: sans, backgroundColor: PAPER }}>
        <Container
          style={{
            maxWidth: "600px",
            margin: "0 auto",
            padding: "40px 20px",
          }}
        >
          <Section
            style={{
              backgroundColor: CARD,
              borderRadius: "8px",
              padding: "40px",
              textAlign: "center" as const,
            }}
          >
            <Text
              style={{
                fontSize: "24px",
                fontWeight: "600",
                color: INK,
                margin: "0 0 16px 0",
              }}
            >
              You&apos;re invited!
            </Text>
            <Text
              style={{
                fontSize: "16px",
                color: INK_SOFT,
                margin: "0 0 24px 0",
              }}
            >
              <strong>{inviterEmail}</strong> has invited you to join{" "}
              <strong>{teamName}</strong> on Fathom Digest.
            </Text>
            <Button
              href={acceptUrl}
              style={{
                backgroundColor: ACCENT,
                color: "#fff",
                padding: "12px 32px",
                borderRadius: "6px",
                fontSize: "16px",
                fontWeight: "600",
                textDecoration: "none",
                display: "inline-block",
              }}
            >
              Accept Invite
            </Button>
            <Text
              style={{
                fontSize: "14px",
                color: INK_SOFT,
                marginTop: "24px",
              }}
            >
              Or copy and paste this link in your browser:
            </Text>
            <Text
              style={{
                fontSize: "12px",
                color: INK_SOFT,
                wordBreak: "break-all" as const,
                margin: "8px 0",
              }}
            >
              {acceptUrl}
            </Text>
          </Section>
        </Container>
      </Body>
    </Html>
  );
}
