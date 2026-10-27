/**
 * Converts the HTML that WordPress / WooCommerce stores (wpautop paragraphs, Visual Composer
 * output, inline styles) into the plain Markdown the new admin edits.
 */

const NAMED_ENTITIES: Record<string, string> = {
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  apos: "'",
  nbsp: " ",
  hellip: "…",
  ndash: "–",
  mdash: "—",
  lsquo: "‘",
  rsquo: "’",
  ldquo: "“",
  rdquo: "”",
  copy: "©",
  reg: "®",
  trade: "™",
  eacute: "é",
  egrave: "è",
  agrave: "à",
  ccedil: "ç",
  times: "×",
  frac12: "½",
  deg: "°",
};

export function decodeEntities(text: string) {
  return text.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+\d*);/gi, (match, code: string) => {
    if (code[0] === "#") {
      const n = code[1] === "x" || code[1] === "X" ? parseInt(code.slice(2), 16) : parseInt(code.slice(1), 10);
      return Number.isFinite(n) ? String.fromCodePoint(n) : match;
    }
    return NAMED_ENTITIES[code.toLowerCase()] ?? match;
  });
}

export function htmlToText(html: string) {
  return decodeEntities(html.replace(/<br\s*\/?>/gi, " ").replace(/<[^>]+>/g, " "))
    .replace(/\s+/g, " ")
    .trim();
}

function attr(tag: string, name: string) {
  const m = tag.match(new RegExp(`\\s${name}\\s*=\\s*(?:"([^"]*)"|'([^']*)'|([^\\s>]+))`, "i"));
  return m ? decodeEntities(m[1] ?? m[2] ?? m[3] ?? "") : null;
}

export type ConvertOptions = {
  /** Rewrites image sources and link targets, e.g. to re-hosted images or relative URLs. */
  rewriteUrl?: (url: string, kind: "image" | "link") => string;
  /** Drops the first heading (when the page title already shows it). */
  dropFirstHeading?: boolean;
};

export function htmlToMarkdown(html: string, options: ConvertOptions = {}) {
  const rewrite = options.rewriteUrl ?? ((u: string) => u);
  let s = html
    .replace(/<!--[\s\S]*?-->/g, "")
    .replace(/<(script|style|noscript|iframe)\b[\s\S]*?<\/\1>/gi, "")
    // Visual Composer / WordPress shortcodes left in the content.
    .replace(/\[\/?(?:vc_|rev_|contact-form|caption|gallery|embed|poller)[^\]]*\]/gi, "")
    .replace(/\s+/g, " ");

  if (options.dropFirstHeading) s = s.replace(/<h[1-6]\b[^>]*>[\s\S]*?<\/h[1-6]>/i, "");

  // Images first so they survive the inline-tag passes below.
  s = s.replace(/<img\b[^>]*>/gi, (tag) => {
    const src = attr(tag, "src");
    if (!src) return "";
    const alt = (attr(tag, "alt") ?? "").replace(/[[\]]/g, "");
    return `![${alt}](${rewrite(src, "image")})`;
  });

  s = s.replace(/<a\b([^>]*)>([\s\S]*?)<\/a>/gi, (_m, attrs: string, inner: string) => {
    const href = attr(`<a ${attrs}>`, "href");
    const label = inner.replace(/<(?!\/?(?:b|strong|i|em)\b)[^>]+>/gi, "").trim();
    if (!href || /^javascript:/i.test(href)) return label;
    if (!label) return "";
    return `[${label}](${rewrite(href, "link")})`;
  });

  // Structural line breaks first, so emphasis can be applied line by line below.
  s = s
    .replace(/<h([1-6])\b[^>]*>/gi, (_m, level: string) => `\n\n${level === "1" || level === "2" ? "##" : level === "3" ? "###" : "####"} `)
    .replace(/<\/h[1-6]>/gi, "\n\n")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<hr\b[^>]*>/gi, "\n\n---\n\n")
    .replace(/<ol\b[^>]*>([\s\S]*?)<\/ol>/gi, (_m, inner: string) => `\n\n${inner.replace(/<li\b[^>]*>/gi, "\n1. ")}\n\n`)
    .replace(/<li\b[^>]*>/gi, "\n- ")
    .replace(/<blockquote\b[^>]*>([\s\S]*?)<\/blockquote>/gi, (_m, inner: string) => `\n\n> ${inner.trim()}\n\n`)
    .replace(/<\/?(?:p|div|section|article|figure|figcaption|ul|ol|table|tr|header|footer|center)\b[^>]*>/gi, "\n\n")
    .replace(/<\/?(?:td|th)\b[^>]*>/gi, " ");

  const emphasize = (text: string, marker: string) => {
    const inner = text.trim();
    if (!/[\p{L}\p{N}]/u.test(inner.replace(/!\[[^\]]*\]\([^)]*\)/g, ""))) return text;
    const lead = /^\s/.test(text) ? " " : "";
    const trail = /\s$/.test(text) ? " " : "";
    return `${lead}${marker}${inner}${marker}${trail}`;
  };
  const wrapInline = (tags: string, marker: string) => {
    s = s.replace(new RegExp(`<(${tags})\\b[^>]*>([\\s\\S]*?)<\\/\\1>`, "gi"), (_m, _t, inner: string) =>
      inner
        .split(/(\n+)/)
        .map((part) => (part.startsWith("\n") ? part : emphasize(part, marker)))
        .join(""),
    );
  };
  wrapInline("strong|b", "**");
  wrapInline("em|i", "*");
  // Merge touching bold runs ("**a** **b**" -> "**a b**") left by adjacent <b> tags.
  s = s.replace(/<[^>]+>/g, "").replace(/\*\*([ \t]*)\*\*/g, "$1");

  s = decodeEntities(s)
    .replace(/\u00a0/g, " ")
    .split("\n")
    .map((line) => line.replace(/[ \t]+/g, " ").trim())
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
  return s;
}
