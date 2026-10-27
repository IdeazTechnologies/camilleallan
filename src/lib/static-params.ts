import "server-only";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { categories, galleryAlbums, pages, products } from "@/db/schema";

/** Cache Components requires at least one param; the placeholder renders notFound(). */
export const PLACEHOLDER_SLUG = "__placeholder__";

async function slugsOr(rows: Promise<Array<{ slug: string }>>) {
  try {
    const list = await rows;
    return list.length ? list.map((r) => ({ slug: r.slug })) : [{ slug: PLACEHOLDER_SLUG }];
  } catch {
    return [{ slug: PLACEHOLDER_SLUG }];
  }
}

export const productSlugs = () =>
  slugsOr(db.select({ slug: products.slug }).from(products).where(eq(products.status, "published")).limit(200));

export const categorySlugs = () => slugsOr(db.select({ slug: categories.slug }).from(categories));

export const albumSlugs = () =>
  slugsOr(db.select({ slug: galleryAlbums.slug }).from(galleryAlbums).where(eq(galleryAlbums.published, true)));

export const pageSlugs = () =>
  slugsOr(db.select({ slug: pages.slug }).from(pages).where(and(eq(pages.published, true))));
