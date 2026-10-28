import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getPage } from "@/lib/catalog";
import { markdownToText, renderFaqItems, renderMarkdown, renderMarkdownSections } from "@/lib/markdown";
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

function FaqList({ body }: { body: string }) {
  const items = renderFaqItems(body);
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: items.map((item) => ({
      "@type": "Question",
      name: item.question,
      acceptedAnswer: { "@type": "Answer", text: item.answerHtml },
    })),
  };
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c") }} />
      <div className="faq-list">
        {items.map((item, i) => (
          <details key={i} className="card faq-item">
            <summary>{item.question}</summary>
            <div className="prose" dangerouslySetInnerHTML={{ __html: item.answerHtml }} />
          </details>
        ))}
      </div>
    </>
  );
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
      {page.layout === "faq" ? (
        <FaqList body={page.body} />
      ) : page.layout === "cards" ? (
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
