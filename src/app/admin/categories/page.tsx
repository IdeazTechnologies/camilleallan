import { asc, eq, sql } from "drizzle-orm";
import type { Metadata } from "next";
import { ConfirmButton } from "@/components/admin/ConfirmButton";
import { AdminHeader } from "@/components/admin/ui";
import { db } from "@/db";
import { categories, products } from "@/db/schema";
import { requireAdmin } from "@/lib/dal";
import { deleteCategoryAction } from "./actions";
import { CategoryForm } from "./CategoryForm";

export const metadata: Metadata = { title: "Categories" };

export default async function AdminCategories() {
  await requireAdmin();
  const list = await db
    .select({
      id: categories.id,
      name: categories.name,
      slug: categories.slug,
      description: categories.description,
      sortOrder: categories.sortOrder,
      productCount: sql<number>`count(${products.id})::int`,
    })
    .from(categories)
    .leftJoin(products, eq(products.categoryId, categories.id))
    .groupBy(categories.id)
    .orderBy(asc(categories.sortOrder), asc(categories.name));

  return (
    <>
      <AdminHeader title="Categories" description="Categories group products in the shop. Empty categories are still shown as filters." />
      <div className="stack">
        {list.map((c) => (
          <div key={c.id} className="card stack stack-sm">
            <div className="spread">
              <strong>
                {c.name} <span className="muted">({c.productCount} product{c.productCount === 1 ? "" : "s"})</span>
              </strong>
              <form action={deleteCategoryAction}>
                <input type="hidden" name="id" value={c.id} />
                <ConfirmButton message={`Delete "${c.name}"? Products in it will become uncategorized.`} className="btn-ghost" style={{ color: "var(--color-danger)" }}>
                  Delete
                </ConfirmButton>
              </form>
            </div>
            <CategoryForm category={c} />
          </div>
        ))}
        <div className="card stack stack-sm">
          <strong>New category</strong>
          <CategoryForm />
        </div>
      </div>
    </>
  );
}
