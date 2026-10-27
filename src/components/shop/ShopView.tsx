import Link from "next/link";
import { ProductGrid } from "@/components/shop/ProductCard";
import { Banners } from "@/components/site/Banners";
import { Poll } from "@/components/site/Poll";
import type { ProductCardData } from "@/lib/catalog";
import { getCategories } from "@/lib/catalog";

type Props = {
  title: string;
  description?: string | null;
  products: ProductCardData[];
  activeSlug?: string;
};

export async function ShopView({ title, description, products, activeSlug }: Props) {
  const categories = await getCategories();
  const available = products.filter((p) => p.stockQty > 0);
  const sold = products.filter((p) => p.stockQty <= 0);

  return (
    <>
      <div className="container">
        <header className="page-header centered">
          <p className="eyebrow">Shop</p>
          <h1>{title}</h1>
          {description && <p className="lede">{description}</p>}
        </header>

        {categories.length > 1 && (
          <nav aria-label="Categories" className="cluster" style={{ justifyContent: "center", marginBottom: "var(--space-6)" }}>
            <Link href="/shop" className={`btn btn-sm ${activeSlug ? "btn-outline" : ""}`} aria-current={!activeSlug ? "page" : undefined}>
              All
            </Link>
            {categories.map((c) => (
              <Link
                key={c.id}
                href={`/shop/${c.slug}`}
                className={`btn btn-sm ${activeSlug === c.slug ? "" : "btn-outline"}`}
                aria-current={activeSlug === c.slug ? "page" : undefined}
              >
                {c.name}
              </Link>
            ))}
          </nav>
        )}

        <Banners placement="shop" className="mt-4" />

        <div className="section-tight">
          {available.length > 0 ? (
            <ProductGrid products={available} priorityCount={4} />
          ) : (
            <div className="empty-state">
              <p className="lede">Everything here has found a home for now. New pieces are on their way.</p>
              <div className="cluster" style={{ justifyContent: "center" }}>
                <Link href="/contact?type=custom_order" className="btn">
                  Ask about a custom piece
                </Link>
                <Link href="/gallery" className="btn btn-outline">
                  Browse the gallery
                </Link>
              </div>
            </div>
          )}
        </div>

        {sold.length > 0 && (
          <section className="section-tight stack stack-lg" aria-labelledby="sold-heading">
            <h2 id="sold-heading" className="text-center" style={{ fontSize: "var(--step-2)" }}>
              Recently adopted
            </h2>
            <ProductGrid products={sold} />
          </section>
        )}
      </div>
      <Poll placement="shop" />
    </>
  );
}
