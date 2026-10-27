import { and, desc, eq, ilike, inArray, or, sql, type SQL } from "drizzle-orm";
import type { Metadata } from "next";
import Link from "next/link";
import { statusTone } from "@/components/shop/OrderDetail";
import { AdminHeader, Empty, Pagination } from "@/components/admin/ui";
import { db } from "@/db";
import { orders, type OrderStatus } from "@/db/schema";
import { requireAdmin } from "@/lib/dal";
import { formatDate, formatMoney, ORDER_STATUS_LABELS } from "@/lib/utils";

export const metadata: Metadata = { title: "Orders" };

const PAGE_SIZE = 50;
const FILTERS: Array<{ key: string; label: string; statuses?: OrderStatus[] }> = [
  { key: "open", label: "To fulfill", statuses: ["paid", "fulfilled"] },
  { key: "paid", label: "Paid", statuses: ["paid"] },
  { key: "shipped", label: "Shipped", statuses: ["shipped"] },
  { key: "pending", label: "Awaiting payment", statuses: ["pending"] },
  { key: "closed", label: "Cancelled / refunded", statuses: ["cancelled", "refunded", "failed"] },
  { key: "all", label: "All" },
];

export default async function AdminOrders({ searchParams }: PageProps<"/admin/orders">) {
  await requireAdmin();
  const params = await searchParams;
  const filterKey = typeof params.status === "string" ? params.status : "open";
  const filter = FILTERS.find((f) => f.key === filterKey) ?? FILTERS[0];
  const q = typeof params.q === "string" ? params.q.trim() : "";
  const page = Math.max(1, Number(params.page) || 1);

  const conditions: SQL[] = [];
  if (filter.statuses) conditions.push(inArray(orders.status, filter.statuses));
  if (q) {
    const num = Number.parseInt(q.replace(/^#/, ""), 10);
    conditions.push(
      or(ilike(orders.email, `%${q}%`), sql`${orders.shippingAddress}->>'name' ilike ${`%${q}%`}`, Number.isFinite(num) ? eq(orders.number, num) : undefined)!,
    );
  }
  const where = conditions.length ? and(...conditions) : undefined;
  const [list, [{ count }]] = await Promise.all([
    db.query.orders.findMany({
      where,
      orderBy: [desc(orders.createdAt)],
      limit: PAGE_SIZE,
      offset: (page - 1) * PAGE_SIZE,
      with: { items: { columns: { quantity: true } } },
    }),
    db.select({ count: sql<number>`count(*)::int` }).from(orders).where(where),
  ]);

  const href = (p: number) => `/admin/orders?${new URLSearchParams({ status: filter.key, ...(q ? { q } : {}), page: String(p) })}`;

  return (
    <>
      <AdminHeader title="Orders" />
      <div className="spread" style={{ marginBottom: "var(--space-4)" }}>
        <nav className="cluster" aria-label="Order filters" style={{ gap: "var(--space-2)" }}>
          {FILTERS.map((f) => (
            <Link key={f.key} href={`/admin/orders?status=${f.key}`} className={`btn btn-sm ${f.key === filter.key ? "" : "btn-outline"}`}>
              {f.label}
            </Link>
          ))}
        </nav>
        <form className="cluster">
          <input type="hidden" name="status" value={filter.key} />
          <input className="input" name="q" placeholder="Order #, email or name" defaultValue={q} style={{ maxWidth: 240, minHeight: 36 }} />
          <button className="btn btn-outline btn-sm" type="submit">
            Search
          </button>
        </form>
      </div>
      {list.length === 0 ? (
        <Empty>No orders here.</Empty>
      ) : (
        <div className="card table-wrap" style={{ padding: 0 }}>
          <table className="table">
            <thead>
              <tr>
                <th>Order</th>
                <th>Date</th>
                <th>Customer</th>
                <th>Status</th>
                <th className="num">Items</th>
                <th className="num">Total</th>
              </tr>
            </thead>
            <tbody>
              {list.map((o) => (
                <tr key={o.id}>
                  <td>
                    <Link href={`/admin/orders/${o.id}`} style={{ fontWeight: 500 }}>
                      #{o.number}
                    </Link>
                  </td>
                  <td>{formatDate(o.createdAt, true)}</td>
                  <td>
                    {o.shippingAddress?.name ?? ""}
                    <div className="muted">{o.email}</div>
                  </td>
                  <td>
                    <span className={`badge ${statusTone(o.status)}`}>{ORDER_STATUS_LABELS[o.status] ?? o.status}</span>
                  </td>
                  <td className="num">{o.items.reduce((n, i) => n + i.quantity, 0)}</td>
                  <td className="num">{formatMoney(o.totalCents, o.currency)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <Pagination page={page} pageCount={Math.ceil(count / PAGE_SIZE)} makeHref={href} />
    </>
  );
}
