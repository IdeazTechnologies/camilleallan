import { describe, expect, it } from "vitest";
import { markdownToText, renderFaqItems, renderMarkdown, renderMarkdownSections } from "@/lib/markdown";
import { isSafeRedirect, parseMoneyToCents, slugify } from "@/lib/utils";

describe("renderMarkdownSections", () => {
  it("splits on lines containing only dashes and drops empty sections", () => {
    const sections = renderMarkdownSections("---\n**One**\n\ntext\n\n---\n\n  ----  \n\nTwo - not a - split\n---");
    expect(sections).toHaveLength(2);
    expect(sections[0]).toContain("<strong>One</strong>");
    expect(sections[1]).toContain("Two - not a - split");
  });

  it("sanitizes each section", () => {
    expect(renderMarkdownSections("<script>x</script>ok\n\n---\n\nnext").join("")).not.toContain("<script");
  });
});

describe("renderFaqItems", () => {
  it("uses each section's first line as the question and the rest as the answer", () => {
    const items = renderFaqItems("## How do I **buy** one?\nSee the [shop](/shop).\n\n---\n\nQuestion only");
    expect(items).toEqual([
      { question: "How do I buy one?", answerHtml: '<p>See the <a href="/shop">shop</a>.</p>\n' },
      { question: "Question only", answerHtml: "" },
    ]);
  });

  it("strips markup from questions and sanitizes answers", () => {
    const [item] = renderFaqItems('<img src=x onerror="alert(1)">Is it safe?\n<script>alert(1)</script>Yes');
    expect(item.question).toBe("Is it safe?");
    expect(item.answerHtml).not.toContain("<script");
  });
});

describe("renderMarkdown", () => {
  it("renders Markdown with line breaks", () => {
    expect(renderMarkdown("**Little Honey**\nby Camille Allen")).toBe("<p><strong>Little Honey</strong><br />by Camille Allen</p>\n");
  });

  it("removes scripts, event handlers and javascript: links", () => {
    const html = renderMarkdown('<script>alert(1)</script><img src="x.jpg" onerror="alert(1)">');
    expect(html).not.toMatch(/script|onerror/i);
    expect(html).toContain('<img src="x.jpg" loading="lazy" />');
    expect(renderMarkdown("[x](javascript:alert(1))")).not.toContain('href="javascript');
  });

  it("opens external links in a new tab only", () => {
    expect(renderMarkdown("[ig](https://instagram.com)")).toContain('target="_blank" rel="noopener noreferrer"');
    expect(renderMarkdown("[shop](/shop)")).not.toContain("target");
  });

  it("produces plain text for meta descriptions", () => {
    expect(markdownToText("## Hello\n\n*sweet* baby")).toBe("Hello sweet baby");
    expect(markdownToText(null)).toBe("");
    expect(markdownToText('Is the "Smell of Rain" true? Tom & Jerry\'s')).toBe('Is the "Smell of Rain" true? Tom & Jerry\'s');
  });
});

describe("slugify", () => {
  it("makes URL-safe slugs", () => {
    expect(slugify("Special release: Twins (Beloved & Morning Sunshine)")).toBe("special-release-twins-beloved-and-morning-sunshine");
    expect(slugify("  Café Crème ")).toBe("cafe-creme");
    expect(slugify("***")).toBe("");
    expect(slugify("a".repeat(100))).toHaveLength(80);
  });
});

describe("parseMoneyToCents", () => {
  it("parses admin price input", () => {
    expect(parseMoneyToCents("99")).toBe(9900);
    expect(parseMoneyToCents("$1,200.50")).toBe(120050);
    expect(parseMoneyToCents("")).toBeNull();
    expect(parseMoneyToCents("abc")).toBeNull();
  });
});

describe("isSafeRedirect", () => {
  it("only allows same-site paths", () => {
    expect(isSafeRedirect("/account")).toBe(true);
    expect(isSafeRedirect("//evil.com")).toBe(false);
    expect(isSafeRedirect("/\\evil.com")).toBe(false);
    expect(isSafeRedirect("https://evil.com")).toBe(false);
    expect(isSafeRedirect(null)).toBe(false);
  });
});
