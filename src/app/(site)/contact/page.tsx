import type { Metadata } from "next";
import { Suspense } from "react";
import { getSettings } from "@/lib/settings";
import { ContactForm } from "./ContactForm";

export const metadata: Metadata = {
  title: "Contact",
  description: "Questions about a sculpture or a custom order? Get in touch with Camille Allen.",
  alternates: { canonical: "/contact" },
};

async function ContactFormWithParams({ searchParams }: { searchParams: PageProps<"/contact">["searchParams"] }) {
  const params = await searchParams;
  const kind = params.type === "custom_order" ? "custom_order" : "general";
  const product = typeof params.product === "string" ? params.product.slice(0, 120) : undefined;
  return <ContactForm defaultKind={kind} defaultSubject={product ? `About "${product}"` : undefined} />;
}

export default async function ContactPage({ searchParams }: PageProps<"/contact">) {
  const settings = await getSettings();
  return (
    <div className="container" style={{ paddingBottom: "var(--space-8)" }}>
      <header className="page-header centered">
        <p className="eyebrow">Contact</p>
        <h1>Say hello</h1>
        <p className="lede">
          Questions about a piece, shipping, or a custom commission? Send a message and Camille will reply personally.
        </p>
      </header>
      <div className="split">
        <div className="card">
          <Suspense fallback={<ContactForm defaultKind="general" />}>
            <ContactFormWithParams searchParams={searchParams} />
          </Suspense>
        </div>
        <aside className="stack">
          {settings.contactEmail && (
            <div className="stack stack-sm">
              <p className="eyebrow">Email</p>
              <a href={`mailto:${settings.contactEmail}`}>{settings.contactEmail}</a>
            </div>
          )}
          {settings.contactPhone && (
            <div className="stack stack-sm">
              <p className="eyebrow">Phone</p>
              <a href={`tel:${settings.contactPhone}`}>{settings.contactPhone}</a>
            </div>
          )}
          <div className="stack stack-sm">
            <p className="eyebrow">Studio</p>
            <p>{settings.location}</p>
          </div>
          {settings.instagramHandle && (
            <div className="stack stack-sm">
              <p className="eyebrow">Instagram</p>
              <a href={`https://www.instagram.com/${settings.instagramHandle}/`} target="_blank" rel="noopener noreferrer">
                @{settings.instagramHandle}
              </a>
            </div>
          )}
        </aside>
      </div>
    </div>
  );
}
