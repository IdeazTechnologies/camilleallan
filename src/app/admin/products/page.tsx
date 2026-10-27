import { and, asc, desc, eq, ilike, or, type SQL } from "drizzle-orm";
import type { Metadata } from "next";
import Link from "next/link";
import { SiteImage } from "@/components/SiteImage";
import { AdminHeader, Empty } from "@/components/admin/ui";
import { db } from "@/db";
import { productImages, products, type ProductStatus } from "@/db/schema";
import { requireAdmin } from "@/lib/dal";
import { formatMoney } from "@/lib/utils";

export const metadata: Metadata = { title: "Products" };

const STATUSES: ProductStatus[] = ["published", "draft", "archived"];

export default async function AdminProducts({ searchParams }: PageProps<"/admin/products">) {
  await requireAdmin();
  const params = await searchParams;
  const q = typeof params.q === "string" ? params.q.trim() : "";
  const status = STATUSES.find((s) => s === params.status);

  const filters: SQL[] = [];
  if (status) filters.push(eq(products.status, status));
  if (q) filters.push(or(ilike(products.title, `%${q}%`), ilike(products.sku, `%${q}%`))!);

  const list = await db.query.products.findMany({
    where: filters.length ? and(...filters) : undefined,
    orderBy: [asc(products.status), desc(products.featured), asc(products.sortOrder), desc(products.createdAt)],
    with: { images: { orderBy: [asc(productImages.sortOrder)], limit: 1 }, category: true },
  });

  return (
    <>
      <AdminHeader
        title="Products"
        actions={
          <Link href="/admin/products/new" className="btn btn-sm">
            Add product
          </Link>
        }
      />
      {params.deleted && <p className="alert success" style={{ marginBottom: "var(--space-4)" }}>Product deleted.</p>}
      <form className="cluster" style={{ marginBottom: "var(--space-4)" }}>
        <input className="input" name="q" placeholder="Search title or SKU" defaultValue={q} style={{ maxWidth: 280 }} />
        <select className="input" name="status" defaultValue={status ?? ""} style={{ maxWidth: 180 }}>
          <option value="">All statuses</option>
          {STATUSES.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
        <button className="btn btn-outline btn-sm" type="submit">
          Filter
        </button>
      </form>
      {list.length === 0 ? (
        <Empty>No products found.</Empty>
      ) : (
        <div className="card table-wrap" style={{ padding: 0 }}>
          <table className="table">
            <thead>
              <tr>
                <th style={{ width: 64 }} />
                <th>Product</th>
                <th>Status</th>
                <th>Category</th>
                <th className="num">Stock</th>
                <th className="num">Price</th>
              </tr>
            </thead>
            <tbody>
              {list.map((p) => (
                <tr key={p.id}>
                  <td>
                    <div style={{ position: "relative", width: 48, height: 48, borderRadius: 6, overflow: "hidden", background: "var(--color-surface-strong)" }}>
                      {p.images[0] && <SiteImage src={p.images[0].url} alt="" fill sizes="48px" style={{ objectFit: "cover" }} />}
                    </div>
                  </td>
                  <td>
                    <Link href={`/admin/products/${p.id}`} style={{ fontWeight: 500 }}>
                      {p.title}
                    </Link>
                    {p.featured && <span className="badge accent" style={{ marginLeft: 8 }}>Featured</span>}
                    {p.sku && <div className="muted">SKU {p.sku}</div>}
                  </td>
                  <td>
                    <span className={`badge ${p.status === "published" ? "success" : p.status === "draft" ? "warning" : ""}`}>{p.status}</span>
                  </td>
                  <td>{p.category?.name ?? "-"}</td>
                  <td className="num">
                    {p.stockQty <= 0 ? <span className="badge danger">Sold out</span> : p.stockQty}
                  </td>
                  <td className="num">{formatMoney(p.priceCents)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
