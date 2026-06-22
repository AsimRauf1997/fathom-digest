import { describe, expect, it } from "vitest";
import {
  excerptFromMarkdown,
  markdownToHtml,
  markdownToHtmlWithLinks,
} from "@/lib/markdown";

describe("excerptFromMarkdown", () => {
  it("returns the first sentence, link-free", () => {
    const md = "## Overview\n[Decided on the new pricing tier.](https://fathom.video/calls/1?t=10) Next steps follow.";
    expect(excerptFromMarkdown(md)).toBe("Decided on the new pricing tier.");
  });

  it("falls back to the full first line when there's no sentence punctuation", () => {
    expect(excerptFromMarkdown("Quick sync about onboarding")).toBe(
      "Quick sync about onboarding",
    );
  });

  it("truncates long lines with an ellipsis", () => {
    const long = "word ".repeat(40).trim();
    const result = excerptFromMarkdown(long, 20);
    expect(result.length).toBeLessThanOrEqual(21);
    expect(result.endsWith("…")).toBe(true);
  });

  it("returns an empty string for empty input", () => {
    expect(excerptFromMarkdown("")).toBe("");
  });
});

describe("markdownToHtmlWithLinks", () => {
  it("keeps links to allowed Fathom hosts as real anchors", () => {
    const html = markdownToHtmlWithLinks(
      "[Kickoff](https://fathom.video/calls/123?timestamp=42)",
    );
    expect(html).toContain('<a href="https://fathom.video/calls/123?timestamp=42"');
    expect(html).toContain(">Kickoff</a>");
  });

  it("drops anchors for hosts outside the allowlist", () => {
    const html = markdownToHtmlWithLinks("[Click me](https://evil.example.com)");
    expect(html).not.toContain("<a ");
    expect(html).toContain("Click me");
  });

  it("still strips links in the unmodified markdownToHtml export", () => {
    const html = markdownToHtml("[Kickoff](https://fathom.video/calls/123)");
    expect(html).not.toContain("<a ");
    expect(html).toContain("Kickoff");
  });
});
