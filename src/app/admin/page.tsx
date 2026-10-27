import { and, desc, eq, gte, inArray, lte, sql } from "drizzle-orm";
import Link from "next/link";
import { statusTone } from "@/components/shop/OrderDetail";
import { AdminHeader, StatCard } from "@/components/admin/ui";
import { db } from "@/db";
import { contactMessages, orders, products } from "@/db/schema";
import { requireAdmin } from "@/lib/dal";
import { getPsigateConfig } from "@/lib/payments/psigate";
import { emailTransport } from "@/lib/email/send";
import { formatDate, formatMoney, ORDER_STATUS_LABELS } from "@/lib/utils";

export default async function AdminDashboard() {
  const user = await requireAdmin();
  const [[toFulfill], [pending], [revenue], [newMessages], lowStock, recent] = await Promise.all([
    db.select({ n: sql<number>`count(*)::int` }).from(orders).where(inArray(orders.status, ["paid", "fulfilled"])),
    db.select({ n: sql<number>`count(*)::int` }).from(orders).where(eq(orders.status, "pending")),
    db
      .select({ cents: sql<number>`coalesce(sum(${orders.totalCents}), 0)::int`, n: sql<number>`count(*)::int` })
      .from(orders)
      .where(and(inArray(orders.status, ["paid", "fulfilled", "shipped"]), gte(orders.paidAt, sql`now() - interval '30 days'`))),
    db.select({ n: sql<number>`count(*)::int` }).from(contactMessages).where(eq(contactMessages.status, "new")),
    db.query.products.findMany({
      where: and(eq(products.status, "published"), lte(products.stockQty, 1)),
      columns: { id: true, title: true, stockQty: true },
      limit: 8,
    }),
    db.query.orders.findMany({
      orderBy: [desc(orders.createdAt)],
      limit: 10,
      columns: { id: true, number: true, email: true, status: true, totalCents: true, currency: true, createdAt: true },
    }),
  ]);
  const psigate = getPsigateConfig();
  const transport = emailTransport();

  return (
    <>
      <AdminHeader title="Dashboard" description={`Welcome back${user.name ? `, ${user.name}` : ""}.`} />

      {(!psigate || psigate.mode !== "live" || transport !== "ideaz") && (
        <div className="stack stack-sm" style={{ marginBottom: "var(--space-5)" }}>
          {!psigate && <p className="alert error">PSiGate is not configured. Customers cannot pay online.</p>}
          {psigate && psigate.mode !== "live" && (
            <p className="alert warning">
              PSiGate is in <strong>{psigate.mode}</strong> mode. Payments are not being charged for real.
            </p>
          )}
          {transport !== "ideaz" && (
            <p className="alert warning">
              Emails are going to the outbox (see <Link href="/admin/emails">Email log</Link>), not to customers. Configure the
              Ideaz API to send real email.
            </p>
          )}
        </div>
      )}

      <div className="form-row" style={{ marginBottom: "var(--space-6)" }}>
        <StatCard label="Orders to fulfill" value={toFulfill.n} href="/admin/orders?status=paid" tone={toFulfill.n ? "warning" : undefined} />
        <StatCard label="Awaiting payment" value={pending.n} href="/admin/orders?status=pending" />
        <StatCard label="Sales, last 30 days" value={formatMoney(revenue.cents)} />
        <StatCard label="New messages" value={newMessages.n} href="/admin/messages" tone={newMessages.n ? "warning" : undefined} />
      </div>

      <div className="split">
        <section className="card stack">
          <div className="spread">
            <h2 style={{ fontSize: "var(--step-1)" }}>Recent orders</h2>
            <Link href="/admin/orders">All orders →</Link>
          </div>
          <div className="table-wrap">
            <table className="table">
              <tbody>
                {recent.map((o) => (
                  <tr key={o.id}>
                    <td>
                      <Link href={`/admin/orders/${o.id}`}>#{o.number}</Link>
                    </td>
                    <td>{o.email}</td>
                    <td>
                      <span className={`badge ${statusTone(o.status)}`}>{ORDER_STATUS_LABELS[o.status]}</span>
                    </td>
                    <td className="num">{formatMoney(o.totalCents, o.currency)}</td>
                    <td className="muted">{formatDate(o.createdAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
        <section className="card stack">
          <h2 style={{ fontSize: "var(--step-1)" }}>Low stock</h2>
          {lowStock.length === 0 ? (
            <p className="muted">Nothing running low.</p>
          ) : (
            <ul className="stack stack-sm" style={{ listStyle: "none", padding: 0 }}>
              {lowStock.map((p) => (
                <li key={p.id} className="spread">
                  <Link href={`/admin/products/${p.id}`}>{p.title}</Link>
                  <span className={`badge ${p.stockQty <= 0 ? "danger" : "warning"}`}>{p.stockQty <= 0 ? "Sold out" : `${p.stockQty} left`}</span>
                </li>
              ))}
            </ul>
          )}
          <Link href="/admin/products/new" className="btn btn-sm" style={{ justifySelf: "start" }}>
            Add a product
          </Link>
        </section>
      </div>
    </>
  );
}
