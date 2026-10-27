import { asc, eq, sql } from "drizzle-orm";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ConfirmButton } from "@/components/admin/ConfirmButton";
import { ImageList } from "@/components/admin/ImageList";
import { ImageUploader } from "@/components/admin/ImageUploader";
import { AdminHeader } from "@/components/admin/ui";
import { db } from "@/db";
import { categories, orderItems, productImages, products } from "@/db/schema";
import { requireAdmin } from "@/lib/dal";
import { centsToInput } from "@/lib/utils";
import { ProductForm } from "../ProductForm";
import { deleteProductAction, updateProductImageAction, uploadProductImagesAction } from "../actions";

export const metadata: Metadata = { title: "Edit product" };

export default async function EditProductPage({ params, searchParams }: PageProps<"/admin/products/[id]">) {
  await requireAdmin();
  const [{ id }, sp] = await Promise.all([params, searchParams]);
  const [product, cats, [{ sold }]] = await Promise.all([
    db.query.products.findFirst({
      where: eq(products.id, id),
      with: { images: { orderBy: [asc(productImages.sortOrder), asc(productImages.createdAt)] } },
    }),
    db.query.categories.findMany({ orderBy: [asc(categories.sortOrder), asc(categories.name)] }),
    db.select({ sold: sql<number>`coalesce(sum(${orderItems.quantity}), 0)::int` }).from(orderItems).where(eq(orderItems.productId, id)),
  ]);
  if (!product) notFound();

  return (
    <>
      <AdminHeader
        title={product.title}
        back={{ href: "/admin/products", label: "Products" }}
        actions={
          product.status === "published" ? (
            <Link href={`/product/${product.slug}`} target="_blank" className="btn btn-outline btn-sm">
              View in store ↗
            </Link>
          ) : null
        }
        description={sold > 0 ? `${sold} sold to date.` : undefined}
      />
      {sp.created && <p className="alert success" style={{ marginBottom: "var(--space-4)" }}>Product created. Now add some photos.</p>}

      <section className="card stack" style={{ marginBottom: "var(--space-5)" }}>
        <h2 style={{ fontSize: "var(--step-1)" }}>Photos</h2>
        <ImageList images={product.images} action={updateProductImageAction} />
        <ImageUploader ownerId={product.id} action={uploadProductImagesAction} />
      </section>

      <section className="card" style={{ marginBottom: "var(--space-5)" }}>
        <ProductForm
          categories={cats}
          product={{
            ...product,
            price: centsToInput(product.priceCents),
            compareAt: centsToInput(product.compareAtCents),
          }}
        />
      </section>

      <section className="card stack stack-sm">
        <h2 style={{ fontSize: "var(--step-1)" }}>Danger zone</h2>
        <p className="muted">
          {sold > 0
            ? "This product appears in past orders. Consider archiving it instead; order history keeps the title and price either way."
            : "Deleting removes the product and its photos permanently."}
        </p>
        <form action={deleteProductAction}>
          <input type="hidden" name="id" value={product.id} />
          <ConfirmButton message={`Delete "${product.title}" permanently?`} className="btn-danger">
            Delete product
          </ConfirmButton>
        </form>
      </section>
    </>
  );
}
