import type { Metadata } from "next";
import { ShopView } from "@/components/shop/ShopView";
import { getShopProducts } from "@/lib/catalog";

export const metadata: Metadata = {
  title: "Shop",
  description: "Lifelike baby dolls and sculptures by Camille Allen, available to adopt today.",
  alternates: { canonical: "/shop" },
};

export default async function ShopPage() {
  const products = (await getShopProducts()) ?? [];
  return <ShopView title="Dolls & sculptures" products={products} />;
}
