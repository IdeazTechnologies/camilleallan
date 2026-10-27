import { desc, eq, ilike, inArray, or, sql } from "drizzle-orm";
import type { Metadata } from "next";
import Link from "next/link";
import { AdminHeader, Empty, Pagination } from "@/components/admin/ui";
import { db } from "@/db";
import { orders, users, type OrderStatus } from "@/db/schema";
import { requireAdmin } from "@/lib/dal";
import { formatDate, formatMoney } from "@/lib/utils";

export const metadata: Metadata = { title: "Customers" };
const PAGE_SIZE = 50;

export default async function AdminCustomers({ searchParams }: PageProps<"/admin/customers">) {
  await requireAdmin();
  const params = await searchParams;
  const q = typeof params.q === "string" ? params.q.trim() : "";
  const page = Math.max(1, Number(params.page) || 1);
  const where = q ? or(ilike(users.email, `%${q}%`), ilike(users.name, `%${q}%`)) : undefined;

  const paidStatuses: OrderStatus[] = ["paid", "fulfilled", "shipped"];
  const [list, [{ count }]] = await Promise.all([
    db
      .select({
        id: users.id,
        email: users.email,
        name: users.name,
        role: users.role,
        createdAt: users.createdAt,
        orderCount: sql<number>`count(${orders.id}) filter (where ${inArray(orders.status, paidStatuses)})::int`,
        spentCents: sql<number>`coalesce(sum(${orders.totalCents}) filter (where ${inArray(orders.status, paidStatuses)}), 0)::int`,
      })
      .from(users)
      .leftJoin(orders, eq(orders.userId, users.id))
      .where(where)
      .groupBy(users.id)
      .orderBy(desc(users.createdAt))
      .limit(PAGE_SIZE)
      .offset((page - 1) * PAGE_SIZE),
    db.select({ count: sql<number>`count(*)::int` }).from(users).where(where),
  ]);

  return (
    <>
      <AdminHeader title="Customers" description={`${count} account${count === 1 ? "" : "s"}.`} />
      <form className="cluster" style={{ marginBottom: "var(--space-4)" }}>
        <input className="input" name="q" placeholder="Search name or email" defaultValue={q} style={{ maxWidth: 280 }} />
        <button className="btn btn-outline btn-sm" type="submit">
          Search
        </button>
      </form>
      {list.length === 0 ? (
        <Empty>No customers found.</Empty>
      ) : (
        <div className="card table-wrap" style={{ padding: 0 }}>
          <table className="table">
            <thead>
              <tr>
                <th>Customer</th>
                <th>Joined</th>
                <th className="num">Orders</th>
                <th className="num">Spent</th>
              </tr>
            </thead>
            <tbody>
              {list.map((u) => (
                <tr key={u.id}>
                  <td>
                    <Link href={`/admin/customers/${u.id}`} style={{ fontWeight: 500 }}>
                      {u.name || u.email}
                    </Link>
                    {u.role === "admin" && <span className="badge accent" style={{ marginLeft: 8 }}>Admin</span>}
                    {u.name && <div className="muted">{u.email}</div>}
                  </td>
                  <td>{formatDate(u.createdAt)}</td>
                  <td className="num">{u.orderCount}</td>
                  <td className="num">{formatMoney(u.spentCents)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <Pagination page={page} pageCount={Math.ceil(count / PAGE_SIZE)} makeHref={(p) => `/admin/customers?${new URLSearchParams({ ...(q ? { q } : {}), page: String(p) })}`} />
    </>
  );
}
