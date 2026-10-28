import "server-only";
import { and, asc, desc, eq, ne, sql } from "drizzle-orm";
import { cacheLife, cacheTag } from "next/cache";
import { db } from "@/db";
import {
  banners,
  categories,
  galleryAlbums,
  galleryImages,
  pages,
  pollOptions,
  polls,
  productImages,
  products,
  type BannerPlacement,
  type PollPlacement,
} from "@/db/schema";

export const TAGS = {
  catalog: "catalog",
  gallery: "gallery",
  pages: "pages",
  banners: "banners",
  polls: "polls",
  settings: "settings",
  instagram: "instagram",
  facebook: "facebook",
} as const;

export type ProductCardData = {
  id: string;
  slug: string;
  title: string;
  summary: string | null;
  priceCents: number;
  compareAtCents: number | null;
  stockQty: number;
  oneOfAKind: boolean;
  featured: boolean;
  categoryName: string | null;
  image: { url: string; alt: string | null } | null;
  hoverImage: { url: string; alt: string | null } | null;
};

const productListQuery = {
  with: {
    images: { orderBy: [asc(productImages.sortOrder)], limit: 2 },
    category: true as const,
  },
  orderBy: [desc(products.featured), asc(products.sortOrder), desc(products.createdAt)],
};

function toCard(p: {
  id: string;
  slug: string;
  title: string;
  summary: string | null;
  priceCents: number;
  compareAtCents: number | null;
  stockQty: number;
  oneOfAKind: boolean;
  featured: boolean;
  category: { name: string } | null;
  images: { url: string; alt: string | null }[];
}): ProductCardData {
  return {
    id: p.id,
    slug: p.slug,
    title: p.title,
    summary: p.summary,
    priceCents: p.priceCents,
    compareAtCents: p.compareAtCents,
    stockQty: p.stockQty,
    oneOfAKind: p.oneOfAKind,
    featured: p.featured,
    categoryName: p.category?.name ?? null,
    image: p.images[0] ? { url: p.images[0].url, alt: p.images[0].alt } : null,
    hoverImage: p.images[1] ? { url: p.images[1].url, alt: p.images[1].alt } : null,
  };
}

export async function getCategories() {
  "use cache";
  cacheLife("hours");
  cacheTag(TAGS.catalog);
  return db.query.categories.findMany({ orderBy: [asc(categories.sortOrder), asc(categories.name)] });
}

export async function getShopProducts(categorySlug?: string) {
  "use cache";
  cacheLife("hours");
  cacheTag(TAGS.catalog);
  let categoryId: string | undefined;
  if (categorySlug) {
    const cat = await db.query.categories.findFirst({ where: eq(categories.slug, categorySlug) });
    if (!cat) return null;
    categoryId = cat.id;
  }
  const rows = await db.query.products.findMany({
    ...productListQuery,
    where: and(
      eq(products.status, "published"),
      categoryId ? eq(products.categoryId, categoryId) : undefined,
    ),
  });
  return rows.map(toCard);
}

export async function getFeaturedProducts(limit = 8) {
  "use cache";
  cacheLife("hours");
  cacheTag(TAGS.catalog);
  const rows = await db.query.products.findMany({
    ...productListQuery,
    where: eq(products.status, "published"),
    limit,
  });
  return rows.map(toCard);
}

export async function getProductBySlug(slug: string) {
  "use cache";
  cacheLife("hours");
  cacheTag(TAGS.catalog);
  const product = await db.query.products.findFirst({
    where: and(eq(products.slug, slug), eq(products.status, "published")),
    with: { images: { orderBy: [asc(productImages.sortOrder)] }, category: true },
  });
  if (!product) return null;
  const related = await db.query.products.findMany({
    ...productListQuery,
    where: and(
      eq(products.status, "published"),
      ne(products.id, product.id),
      product.categoryId ? eq(products.categoryId, product.categoryId) : undefined,
    ),
    limit: 4,
  });
  return { product, related: related.map(toCard) };
}

export async function getGalleryAlbums() {
  "use cache";
  cacheLife("hours");
  cacheTag(TAGS.gallery);
  return db.query.galleryAlbums.findMany({
    where: eq(galleryAlbums.published, true),
    orderBy: [asc(galleryAlbums.sortOrder), desc(galleryAlbums.createdAt)],
    with: { images: { orderBy: [asc(galleryImages.sortOrder)], limit: 1 } },
  });
}

export async function getAllGalleryImages() {
  "use cache";
  cacheLife("hours");
  cacheTag(TAGS.gallery);
  const albums = await db.query.galleryAlbums.findMany({
    where: eq(galleryAlbums.published, true),
    orderBy: [asc(galleryAlbums.sortOrder), desc(galleryAlbums.createdAt)],
    with: { images: { orderBy: [asc(galleryImages.sortOrder), asc(galleryImages.createdAt)] } },
  });
  return albums.flatMap((album) => album.images);
}

export async function getGalleryAlbum(slug: string) {
  "use cache";
  cacheLife("hours");
  cacheTag(TAGS.gallery);
  return (
    (await db.query.galleryAlbums.findFirst({
      where: and(eq(galleryAlbums.slug, slug), eq(galleryAlbums.published, true)),
      with: { images: { orderBy: [asc(galleryImages.sortOrder), asc(galleryImages.createdAt)] } },
    })) ?? null
  );
}

export async function getNavPages() {
  "use cache";
  cacheLife("days");
  cacheTag(TAGS.pages);
  return db.query.pages.findMany({
    where: and(eq(pages.published, true), eq(pages.showInNav, true)),
    orderBy: [asc(pages.navOrder), asc(pages.title)],
    columns: { slug: true, title: true },
  });
}

export async function getPublishedPages() {
  "use cache";
  cacheLife("days");
  cacheTag(TAGS.pages);
  return db.query.pages.findMany({
    where: eq(pages.published, true),
    orderBy: [asc(pages.navOrder), asc(pages.title)],
    columns: { slug: true, title: true, updatedAt: true },
  });
}

export async function getPage(slug: string) {
  "use cache";
  cacheLife("days");
  cacheTag(TAGS.pages);
  return (
    (await db.query.pages.findFirst({ where: and(eq(pages.slug, slug), eq(pages.published, true)) })) ??
    null
  );
}

export async function getBanners(placement: BannerPlacement) {
  "use cache";
  // Short lifetime so scheduled start/end times take effect promptly.
  cacheLife("minutes");
  cacheTag(TAGS.banners);
  return db.query.banners.findMany({
    where: and(
      eq(banners.placement, placement),
      eq(banners.active, true),
      sql`(${banners.startsAt} is null or ${banners.startsAt} <= now())`,
      sql`(${banners.endsAt} is null or ${banners.endsAt} > now())`,
    ),
    orderBy: [asc(banners.sortOrder), desc(banners.createdAt)],
  });
}

export async function getActivePoll(placement: PollPlacement) {
  "use cache";
  cacheLife("minutes");
  cacheTag(TAGS.polls);
  return (
    (await db.query.polls.findFirst({
      where: and(
        eq(polls.placement, placement),
        eq(polls.active, true),
        sql`(${polls.closesAt} is null or ${polls.closesAt} > now())`,
      ),
      orderBy: [desc(polls.createdAt)],
      with: { options: { orderBy: [asc(pollOptions.sortOrder)] } },
    })) ?? null
  );
}
