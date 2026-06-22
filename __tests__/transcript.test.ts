import { describe, expect, it } from "vitest";
import { groupBySpeaker, speakerColorIndex, turnsToPlainText } from "@/lib/transcript";
import type { TranscriptItem } from "@/lib/types";

const items: TranscriptItem[] = [
  { speaker: "Alice", text: "Let's start.", timestamp: "00:00:01" },
  { speaker: "Alice", text: "First topic is budget.", timestamp: "00:00:05" },
  { speaker: "Bob", text: "Sounds good.", timestamp: "00:00:10" },
  { speaker: "Alice", text: "Moving on.", timestamp: "00:00:15" },
];

describe("groupBySpeaker", () => {
  it("collapses consecutive same-speaker lines into one turn", () => {
    const turns = groupBySpeaker(items);
    expect(turns).toHaveLength(3);
    expect(turns[0]).toEqual({
      speaker: "Alice",
      lines: [
        { text: "Let's start.", timestamp: "00:00:01" },
        { text: "First topic is budget.", timestamp: "00:00:05" },
      ],
    });
    expect(turns[1].speaker).toBe("Bob");
    expect(turns[2].speaker).toBe("Alice");
  });

  it("returns an empty array for no items", () => {
    expect(groupBySpeaker([])).toEqual([]);
  });
});

describe("speakerColorIndex", () => {
  it("is deterministic for the same speaker name", () => {
    expect(speakerColorIndex("Alice")).toBe(speakerColorIndex("Alice"));
  });

  it("stays within the fixed palette range", () => {
    for (const name of ["Alice", "Bob", "Charlie", ""]) {
      const idx = speakerColorIndex(name);
      expect(idx).toBeGreaterThanOrEqual(0);
      expect(idx).toBeLessThan(4);
    }
  });
});

describe("turnsToPlainText", () => {
  it("serializes turns as speaker [timestamp]: text lines", () => {
    const turns = groupBySpeaker(items);
    const text = turnsToPlainText(turns);
    expect(text).toContain("Alice [00:00:01]: Let's start.");
    expect(text).toContain("Bob [00:00:10]: Sounds good.");
    expect(text.split("\n\n")).toHaveLength(3);
  });
});
