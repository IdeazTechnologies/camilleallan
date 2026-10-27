import type { MetadataRoute } from "next";
import { getCategories, getGalleryAlbums, getPublishedPages, getShopProducts } from "@/lib/catalog";
import { appUrl } from "@/lib/utils";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const [products, categories, albums, pages] = await Promise.all([
    getShopProducts(),
    getCategories(),
    getGalleryAlbums(),
    getPublishedPages(),
  ]);
  return [
    { url: appUrl("/"), changeFrequency: "weekly", priority: 1 },
    { url: appUrl("/shop"), changeFrequency: "daily", priority: 0.9 },
    { url: appUrl("/gallery"), changeFrequency: "monthly", priority: 0.7 },
    { url: appUrl("/contact"), changeFrequency: "yearly", priority: 0.5 },
    ...(products ?? []).map((p) => ({ url: appUrl(`/product/${p.slug}`), changeFrequency: "weekly" as const, priority: 0.8 })),
    ...categories.map((c) => ({ url: appUrl(`/shop/${c.slug}`), changeFrequency: "weekly" as const, priority: 0.6 })),
    ...albums.map((a) => ({ url: appUrl(`/gallery/${a.slug}`), changeFrequency: "monthly" as const, priority: 0.5 })),
    ...pages.map((p) => ({ url: appUrl(`/${p.slug}`), lastModified: p.updatedAt, changeFrequency: "monthly" as const, priority: 0.5 })),
  ];
}
