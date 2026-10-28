/** Splits Markdown on lines containing only `---`, dropping empty parts. Used by the "cards" page layout. */
export function splitMarkdownSections(source: string) {
  return source
    .split(/^[ \t]*-{3,}[ \t]*$/m)
    .map((part) => part.trim())
    .filter(Boolean);
}

/** For the "faq" layout: each section's first line (with any leading `#`s removed) is the question, the rest is the answer. */
export function splitFaqItems(source: string) {
  return splitMarkdownSections(source).map((section) => {
    const newline = section.indexOf("\n");
    const first = newline === -1 ? section : section.slice(0, newline);
    return {
      question: first.replace(/^#{1,6}[ \t]+/, "").trim(),
      answer: newline === -1 ? "" : section.slice(newline + 1).trim(),
    };
  });
}
