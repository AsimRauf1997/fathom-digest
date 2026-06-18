// Shared, link-free Markdown helpers used by both the email digest and the UI.

/**
 * Removes Markdown links/images and autolinks, keeping only the visible text.
 * Fathom summaries wrap nearly every line in a timestamp link; per requirements
 * we render summaries as plain text with NO links.
 */
export function stripMarkdownLinks(md: string): string {
  return md
    .replace(/!\[([^\]]*)\]\([^)]*\)/g, "$1") // images ![alt](url) -> alt
    .replace(/\[([^\]]*)\]\([^)]*\)/g, "$1") // links [text](url) -> text
    .replace(/<https?:\/\/[^>]+>/g, ""); // autolinks <http...> -> ""
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function inline(s: string): string {
  return s.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");
}

/**
 * Minimal, safe Markdown -> HTML. Handles headings, bullet lists, bold, and
 * paragraphs. Everything is escaped first and all links are stripped, so the
 * output is safe to inject and never contains anchors.
 */
export function markdownToHtml(md: string): string {
  const lines = escapeHtml(stripMarkdownLinks(md).replace(/\r\n/g, "\n")).split(
    "\n",
  );
  const out: string[] = [];
  let inList = false;

  const closeList = () => {
    if (inList) {
      out.push("</ul>");
      inList = false;
    }
  };

  for (const raw of lines) {
    const line = raw.trimEnd();
    const bullet = line.match(/^\s*[-*]\s+(.*)$/);
    const heading = line.match(/^(#{1,4})\s+(.*)$/);

    if (bullet) {
      if (!inList) {
        out.push('<ul style="margin:6px 0;padding-left:20px;">');
        inList = true;
      }
      out.push(`<li>${inline(bullet[1])}</li>`);
    } else if (heading) {
      closeList();
      const level = Math.min(heading[1].length + 2, 6);
      out.push(
        `<h${level} style="margin:14px 0 4px;font-size:15px;">${inline(
          heading[2],
        )}</h${level}>`,
      );
    } else if (line.trim() === "") {
      closeList();
    } else {
      closeList();
      out.push(`<p style="margin:6px 0;">${inline(line)}</p>`);
    }
  }
  closeList();
  return out.join("\n");
}
