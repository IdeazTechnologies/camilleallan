import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getPage } from "@/lib/catalog";
import { markdownToText, renderMarkdown, renderMarkdownSections } from "@/lib/markdown";
import { pageSlugs } from "@/lib/static-params";

export const generateStaticParams = pageSlugs;

export async function generateMetadata({ params }: PageProps<"/[slug]">): Promise<Metadata> {
  const { slug } = await params;
  const page = await getPage(slug);
  if (!page) return { title: "Not found" };
  return {
    title: page.title,
    description: page.metaDescription || markdownToText(page.body).slice(0, 160),
    alternates: { canonical: `/${page.slug}` },
  };
}

export default async function CmsPage({ params }: PageProps<"/[slug]">) {
  const { slug } = await params;
  const page = await getPage(slug);
  if (!page) notFound();
  return (
    <article className="container-narrow" style={{ paddingBottom: "var(--space-8)" }}>
      <header className="page-header centered">
        <h1>{page.title}</h1>
      </header>
      {page.layout === "cards" ? (
        <div className="card-list">
          {renderMarkdownSections(page.body).map((html, i) => (
            <section key={i} className="card prose" dangerouslySetInnerHTML={{ __html: html }} />
          ))}
        </div>
      ) : (
        <div className="prose" style={{ marginInline: "auto" }} dangerouslySetInnerHTML={{ __html: renderMarkdown(page.body) }} />
      )}
    </article>
  );
}
