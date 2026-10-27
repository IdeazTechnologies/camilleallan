import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ShopView } from "@/components/shop/ShopView";
import { getCategories, getShopProducts } from "@/lib/catalog";
import { categorySlugs } from "@/lib/static-params";

export async function generateStaticParams() {
  return (await categorySlugs()).map(({ slug }) => ({ category: slug }));
}

async function findCategory(slug: string) {
  return (await getCategories()).find((c) => c.slug === slug) ?? null;
}

export async function generateMetadata({ params }: PageProps<"/shop/[category]">): Promise<Metadata> {
  const { category } = await params;
  const cat = await findCategory(category);
  if (!cat) return { title: "Not found" };
  return { title: cat.name, description: cat.description ?? undefined, alternates: { canonical: `/shop/${cat.slug}` } };
}

export default async function CategoryPage({ params }: PageProps<"/shop/[category]">) {
  const { category } = await params;
  const [cat, products] = await Promise.all([findCategory(category), getShopProducts(category)]);
  if (!cat || !products) notFound();
  return <ShopView title={cat.name} description={cat.description} products={products} activeSlug={cat.slug} />;
}
