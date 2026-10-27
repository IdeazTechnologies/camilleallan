import { asc } from "drizzle-orm";
import type { Metadata } from "next";
import { AdminHeader } from "@/components/admin/ui";
import { db } from "@/db";
import { categories } from "@/db/schema";
import { requireAdmin } from "@/lib/dal";
import { ProductForm } from "../ProductForm";

export const metadata: Metadata = { title: "New product" };

export default async function NewProductPage() {
  await requireAdmin();
  const cats = await db.query.categories.findMany({ orderBy: [asc(categories.sortOrder), asc(categories.name)] });
  return (
    <>
      <AdminHeader
        title="New product"
        back={{ href: "/admin/products", label: "Products" }}
        description="Save the product first, then add photos."
      />
      <div className="card">
        <ProductForm categories={cats} />
      </div>
    </>
  );
}
