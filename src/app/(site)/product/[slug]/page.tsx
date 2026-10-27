import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ProductGallery } from "@/components/gallery/ProductGallery";
import { AddToCart } from "@/components/shop/AddToCart";
import { Price, ProductGrid } from "@/components/shop/ProductCard";
import { Banners } from "@/components/site/Banners";
import { getProductBySlug } from "@/lib/catalog";
import { markdownToText, renderMarkdown } from "@/lib/markdown";
import { getSettings } from "@/lib/settings";
import { productSlugs } from "@/lib/static-params";
import { appUrl } from "@/lib/utils";
import styles from "./product.module.css";

export const generateStaticParams = productSlugs;

export async function generateMetadata({ params }: PageProps<"/product/[slug]">): Promise<Metadata> {
  const { slug } = await params;
  const data = await getProductBySlug(slug);
  if (!data) return { title: "Not found" };
  const { product } = data;
  const description = (product.summary || markdownToText(product.description)).slice(0, 160);
  return {
    title: product.title,
    description,
    alternates: { canonical: `/product/${product.slug}` },
    openGraph: {
      title: product.title,
      description,
      images: product.images[0] ? [{ url: product.images[0].url }] : undefined,
    },
  };
}

export default async function ProductPage({ params }: PageProps<"/product/[slug]">) {
  const { slug } = await params;
  const [data, settings] = await Promise.all([getProductBySlug(slug), getSettings()]);
  if (!data) notFound();
  const { product, related } = data;
  const soldOut = product.stockQty <= 0;

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Product",
    name: product.title,
    image: product.images.map((i) => i.url),
    description: product.summary || markdownToText(product.description).slice(0, 500),
    sku: product.sku ?? undefined,
    brand: { "@type": "Brand", name: settings.storeName },
    offers: {
      "@type": "Offer",
      url: appUrl(`/product/${product.slug}`),
      priceCurrency: settings.currency,
      price: (product.priceCents / 100).toFixed(2),
      availability: soldOut ? "https://schema.org/SoldOut" : "https://schema.org/InStock",
    },
  };

  return (
    <div className="container section-tight">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c") }} />
      <nav aria-label="Breadcrumb">
        <ol className="breadcrumbs">
          <li>
            <Link href="/">Home</Link>
          </li>
          <li>
            <Link href="/shop">Shop</Link>
          </li>
          {product.category && (
            <li>
              <Link href={`/shop/${product.category.slug}`}>{product.category.name}</Link>
            </li>
          )}
          <li aria-current="page">{product.title}</li>
        </ol>
      </nav>

      <div className={styles.layout}>
        <ProductGallery
          title={product.title}
          images={product.images.map((i) => ({ url: i.url, alt: i.alt, width: i.width, height: i.height }))}
        />

        <div className={styles.details}>
          <div className="stack stack-sm">
            {product.category && <p className="eyebrow">{product.category.name}</p>}
            <h1 className={styles.title}>{product.title}</h1>
            <p className={styles.price}>
              <Price cents={product.priceCents} compareAtCents={product.compareAtCents} />
            </p>
          </div>

          <p className="cluster" style={{ fontSize: "var(--step--1)" }}>
            {soldOut ? (
              <span className="badge">Sold</span>
            ) : product.oneOfAKind ? (
              <span className="badge accent">One of a kind</span>
            ) : product.stockQty <= 3 ? (
              <span className="badge warning">Only {product.stockQty} left</span>
            ) : (
              <span className="badge success">In stock</span>
            )}
            {product.sku && <span className="muted">SKU {product.sku}</span>}
          </p>

          {product.summary && <p className="lede">{product.summary}</p>}

          <AddToCart productId={product.id} stockQty={product.stockQty} allowQuantity={!product.oneOfAKind} />

          <Banners placement="product" />

          {product.description && (
            <div className="prose" dangerouslySetInnerHTML={{ __html: renderMarkdown(product.description) }} />
          )}

          <details className={styles.more}>
            <summary>Shipping &amp; care</summary>
            <p>
              Every piece is carefully packed and shipped from {settings.location}. Shipping options and costs are shown at
              checkout. Each sculpture is a delicate work of art, not a toy: keep away from direct sunlight and heat, and
              handle with clean hands.
            </p>
          </details>
          <details className={styles.more}>
            <summary>Questions or custom requests?</summary>
            <p>
              <Link href={`/contact?type=custom_order&product=${encodeURIComponent(product.title)}`}>Send Camille a message</Link>{" "}
              about this piece or a custom commission.
            </p>
          </details>
        </div>
      </div>

      {related.length > 0 && (
        <section className="section stack stack-lg" aria-labelledby="related-heading">
          <h2 id="related-heading" className="text-center">
            You may also love
          </h2>
          <ProductGrid products={related} />
        </section>
      )}
    </div>
  );
}
