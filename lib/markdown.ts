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
  return mdToHtml(md, { preserveLinks: false });
}

// Hosts Fathom is known to put in summary timestamp links. Anything else
// found in a [text](url) pair is treated as plain text, not a real anchor —
// the markdown comes from a trusted API, but we still don't want to turn
// arbitrary hrefs into clickable links inside dangerouslySetInnerHTML.
const ALLOWED_LINK_HOSTS = [/(^|\.)fathom\.video$/, /(^|\.)fathom\.ai$/];

function isAllowedLinkUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    return (
      parsed.protocol === "https:" &&
      ALLOWED_LINK_HOSTS.some((re) => re.test(parsed.hostname))
    );
  } catch {
    return false;
  }
}

/**
 * Same rendering as {@link markdownToHtml}, but keeps Fathom's own
 * timestamp links (jump back to that moment in the recording) as real
 * anchors instead of stripping them. Used only by the web detail view —
 * the email digest keeps the link-free behavior of `markdownToHtml`.
 */
export function markdownToHtmlWithLinks(md: string): string {
  return mdToHtml(md, { preserveLinks: true });
}

function inlineWithLinks(s: string, preserveLinks: boolean): string {
  if (!preserveLinks) return inline(stripMarkdownLinks(s));

  // Walk the raw (unescaped) line so link URLs are captured before HTML
  // escaping, then escape + bold-ify everything in between matches.
  let out = "";
  let last = 0;
  const linkRe = /\[([^\]]*)\]\(([^)]*)\)/g;
  let m: RegExpExecArray | null;
  while ((m = linkRe.exec(s))) {
    out += inline(escapeHtml(s.slice(last, m.index)));
    const [, text, url] = m;
    if (isAllowedLinkUrl(url)) {
      out += `<a href="${escapeHtml(url)}" target="_blank" rel="noreferrer noopener">${inline(
        escapeHtml(text),
      )}</a>`;
    } else {
      out += inline(escapeHtml(text));
    }
    last = m.index + m[0].length;
  }
  out += inline(escapeHtml(s.slice(last)));
  return out;
}

function mdToHtml(md: string, opts: { preserveLinks: boolean }): string {
  const normalized = md.replace(/\r\n/g, "\n");
  const lines = (opts.preserveLinks ? normalized : escapeHtml(stripMarkdownLinks(normalized))).split(
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
      out.push(`<li>${inlineWithLinks(bullet[1], opts.preserveLinks)}</li>`);
    } else if (heading) {
      closeList();
      const level = Math.min(heading[1].length + 2, 6);
      out.push(
        `<h${level} style="margin:14px 0 4px;font-size:15px;">${inlineWithLinks(
          heading[2],
          opts.preserveLinks,
        )}</h${level}>`,
      );
    } else if (line.trim() === "") {
      closeList();
    } else {
      closeList();
      out.push(`<p style="margin:6px 0;">${inlineWithLinks(line, opts.preserveLinks)}</p>`);
    }
  }
  closeList();
  return out.join("\n");
}

/**
 * First real sentence/line of a markdown summary, link-free and capped to
 * a short length — used for the compact meeting-card excerpt.
 */
export function excerptFromMarkdown(md: string, maxLength = 140): string {
  const plain = stripMarkdownLinks(md)
    .split("\n")
    .filter((line) => !/^\s*#{1,4}\s+/.test(line))
    .join(" ")
    .replace(/[*_`]/g, "")
    .replace(/^\s*[-*]\s+/, "")
    .replace(/\s+/g, " ")
    .trim();
  if (!plain) return "";

  const sentenceMatch = plain.match(/^.*?[.!?](?=\s|$)/);
  const candidate = sentenceMatch ? sentenceMatch[0] : plain;

  if (candidate.length <= maxLength) return candidate;
  return `${candidate.slice(0, maxLength).trimEnd()}…`;
}
