import type { TranscriptItem } from "./types";

export interface TranscriptTurn {
  speaker: string;
  lines: { text: string; timestamp: string }[];
}

/**
 * Collapses consecutive same-speaker transcript lines into one turn, so the
 * UI doesn't repeat a speaker label on every single line of a back-and-forth.
 */
export function groupBySpeaker(items: TranscriptItem[]): TranscriptTurn[] {
  const turns: TranscriptTurn[] = [];

  for (const item of items) {
    const last = turns[turns.length - 1];
    if (last && last.speaker === item.speaker) {
      last.lines.push({ text: item.text, timestamp: item.timestamp });
    } else {
      turns.push({
        speaker: item.speaker,
        lines: [{ text: item.text, timestamp: item.timestamp }],
      });
    }
  }

  return turns;
}

// Deterministic speaker -> accent mapping, cycling through a fixed palette
// pulled from the existing design tokens (see the .turn-color-* rules in
// globals.css) — no per-speaker state, same name always gets the same color.
const SPEAKER_COLOR_COUNT = 4;

export function speakerColorIndex(speaker: string): number {
  let hash = 0;
  for (let i = 0; i < speaker.length; i++) {
    hash = (hash * 31 + speaker.charCodeAt(i)) | 0;
  }
  return Math.abs(hash) % SPEAKER_COLOR_COUNT;
}

/** Plain-text serialization of grouped turns, for the "copy transcript" action. */
export function turnsToPlainText(turns: TranscriptTurn[]): string {
  return turns
    .map((turn) =>
      turn.lines
        .map((line) => `${turn.speaker} [${line.timestamp}]: ${line.text}`)
        .join("\n"),
    )
    .join("\n\n");
}
