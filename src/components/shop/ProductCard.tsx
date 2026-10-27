import Link from "next/link";
import { ImagePlaceholder, SiteImage } from "@/components/SiteImage";
import type { ProductCardData } from "@/lib/catalog";
import { formatMoney } from "@/lib/utils";
import styles from "./ProductCard.module.css";

export function Price({ cents, compareAtCents }: { cents: number; compareAtCents?: number | null }) {
  return (
    <span className="price">
      {compareAtCents && compareAtCents > cents ? <s>{formatMoney(compareAtCents)}</s> : null}
      {formatMoney(cents)}
    </span>
  );
}

export function ProductCard({ product, priority = false }: { product: ProductCardData; priority?: boolean }) {
  const soldOut = product.stockQty <= 0;
  return (
    <article className={styles.card}>
      <Link href={`/product/${product.slug}`} className={styles.media}>
        {product.image ? (
          <SiteImage
            src={product.image.url}
            alt={product.image.alt || product.title}
            fill
            sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
            className={styles.primary}
            priority={priority}
          />
        ) : (
          <ImagePlaceholder />
        )}
        {product.hoverImage && (
          <SiteImage
            src={product.hoverImage.url}
            alt=""
            fill
            sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
            className={styles.hover}
          />
        )}
        <span className={styles.badges}>
          {soldOut ? (
            <span className="badge">Sold</span>
          ) : product.compareAtCents && product.compareAtCents > product.priceCents ? (
            <span className="badge accent">Sale</span>
          ) : product.oneOfAKind ? (
            <span className="badge accent">One of a kind</span>
          ) : null}
        </span>
      </Link>
      <div className={styles.body}>
        {product.categoryName && <p className={styles.category}>{product.categoryName}</p>}
        <h3 className={styles.title}>
          <Link href={`/product/${product.slug}`}>{product.title}</Link>
        </h3>
        <Price cents={product.priceCents} compareAtCents={product.compareAtCents} />
      </div>
    </article>
  );
}

export function ProductGrid({ products, priorityCount = 0 }: { products: ProductCardData[]; priorityCount?: number }) {
  return (
    <div className={styles.grid}>
      {products.map((p, i) => (
        <ProductCard key={p.id} product={p} priority={i < priorityCount} />
      ))}
    </div>
  );
}

export function ProductGridSkeleton({ count = 8 }: { count?: number }) {
  return (
    <div className={styles.grid} aria-busy="true" aria-label="Loading">
      {Array.from({ length: count }, (_, i) => (
        <div key={i} className="stack stack-sm">
          <div className="skeleton" style={{ aspectRatio: "4 / 5" }} />
          <div className="skeleton" style={{ height: "1rem", width: "70%" }} />
          <div className="skeleton" style={{ height: "1rem", width: "35%" }} />
        </div>
      ))}
    </div>
  );
}
