import { marked } from "marked";
import sanitizeHtml from "sanitize-html";
import { splitFaqItems, splitMarkdownSections } from "./markdown-sections";

const allowed: sanitizeHtml.IOptions = {
  allowedTags: [
    "p", "br", "strong", "em", "b", "i", "u", "s", "a", "ul", "ol", "li", "blockquote",
    "h2", "h3", "h4", "hr", "img", "figure", "figcaption", "table", "thead", "tbody", "tr", "th", "td", "code", "pre",
  ],
  allowedAttributes: {
    a: ["href", "title", "target", "rel"],
    img: ["src", "alt", "title", "width", "height", "loading"],
    th: ["align"],
    td: ["align"],
  },
  allowedSchemes: ["http", "https", "mailto", "tel"],
  transformTags: {
    a: (tagName, attribs) => {
      const external = /^https?:\/\//.test(attribs.href ?? "");
      return {
        tagName,
        attribs: external ? { ...attribs, target: "_blank", rel: "noopener noreferrer" } : attribs,
      };
    },
    img: (tagName, attribs) => ({ tagName, attribs: { ...attribs, loading: "lazy" } }),
  },
};

/** Renders admin-authored Markdown to HTML that is safe to inject with dangerouslySetInnerHTML. */
export function renderMarkdown(source: string | null | undefined) {
  if (!source) return "";
  const html = marked.parse(source, { async: false, gfm: true, breaks: true }) as string;
  return sanitizeHtml(html, allowed);
}

export function renderMarkdownSections(source: string | null | undefined) {
  if (!source) return [];
  return splitMarkdownSections(source).map(renderMarkdown);
}

/** Questions come back as plain text (render them as React text); answers as sanitized HTML. */
export function renderFaqItems(source: string | null | undefined) {
  if (!source) return [];
  return splitFaqItems(source).map(({ question, answer }) => ({
    question: markdownToText(question),
    answerHtml: renderMarkdown(answer),
  }));
}

export function markdownToText(source: string | null | undefined) {
  if (!source) return "";
  return sanitizeHtml(renderMarkdown(source), { allowedTags: [], allowedAttributes: {} })
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, "&")
    .replace(/\s+/g, " ")
    .trim();
}
