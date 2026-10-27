/** Splits Markdown on lines containing only `---`, dropping empty parts. Used by the "cards" page layout. */
export function splitMarkdownSections(source: string) {
  return source
    .split(/^[ \t]*-{3,}[ \t]*$/m)
    .map((part) => part.trim())
    .filter(Boolean);
}
