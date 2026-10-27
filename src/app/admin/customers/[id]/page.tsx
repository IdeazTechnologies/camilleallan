import { desc, eq } from "drizzle-orm";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ConfirmButton } from "@/components/admin/ConfirmButton";
import { statusTone } from "@/components/shop/OrderDetail";
import { AdminHeader } from "@/components/admin/ui";
import { db } from "@/db";
import { addresses, newsletterSubscribers, orders, users } from "@/db/schema";
import { formatAddressLines } from "@/lib/address";
import { requireAdmin } from "@/lib/dal";
import { formatDate, formatMoney, ORDER_STATUS_LABELS } from "@/lib/utils";
import { setRoleAction } from "../actions";

export const metadata: Metadata = { title: "Customer" };

export default async function AdminCustomerPage({ params }: PageProps<"/admin/customers/[id]">) {
  const admin = await requireAdmin();
  const { id } = await params;
  const user = await db.query.users.findFirst({ where: eq(users.id, id) });
  if (!user) notFound();
  const [orderList, addressList, subscriber] = await Promise.all([
    db.query.orders.findMany({ where: eq(orders.userId, id), orderBy: [desc(orders.createdAt)] }),
    db.query.addresses.findMany({ where: eq(addresses.userId, id), orderBy: [desc(addresses.isDefault)] }),
    db.query.newsletterSubscribers.findFirst({ where: eq(newsletterSubscribers.email, user.email) }),
  ]);

  return (
    <>
      <AdminHeader title={user.name || user.email} back={{ href: "/admin/customers", label: "Customers" }} />
      <div className="split">
        <section className="card stack">
          <h2 style={{ fontSize: "var(--step-1)" }}>Orders</h2>
          {orderList.length === 0 ? (
            <p className="muted">No orders.</p>
          ) : (
            <div className="table-wrap">
              <table className="table">
                <tbody>
                  {orderList.map((o) => (
                    <tr key={o.id}>
                      <td>
                        <Link href={`/admin/orders/${o.id}`}>#{o.number}</Link>
                      </td>
                      <td>{formatDate(o.createdAt)}</td>
                      <td>
                        <span className={`badge ${statusTone(o.status)}`}>{ORDER_STATUS_LABELS[o.status]}</span>
                      </td>
                      <td className="num">{formatMoney(o.totalCents, o.currency)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
        <aside className="stack stack-lg">
          <section className="card stack stack-sm">
            <h2 style={{ fontSize: "var(--step-1)" }}>Details</h2>
            <a href={`mailto:${user.email}`}>{user.email}</a>
            {user.phone && <span>{user.phone}</span>}
            <span className="muted">Joined {formatDate(user.createdAt)}</span>
            <span className="muted">Newsletter: {subscriber?.status ?? "not subscribed"}</span>
          </section>
          <section className="card stack stack-sm">
            <h2 style={{ fontSize: "var(--step-1)" }}>Addresses</h2>
            {addressList.length === 0 && <p className="muted">None saved.</p>}
            {addressList.map((a) => (
              <address key={a.id} style={{ fontStyle: "normal", fontSize: "var(--step--1)" }}>
                {formatAddressLines(a).map((l, i) => (
                  <div key={i}>{l}</div>
                ))}
              </address>
            ))}
          </section>
          <section className="card stack stack-sm">
            <h2 style={{ fontSize: "var(--step-1)" }}>Access</h2>
            <p>
              Role: <strong>{user.role}</strong>
            </p>
            {user.id !== admin.id && (
              <form action={setRoleAction}>
                <input type="hidden" name="id" value={user.id} />
                <input type="hidden" name="role" value={user.role === "admin" ? "customer" : "admin"} />
                <ConfirmButton
                  message={user.role === "admin" ? "Remove admin access for this person?" : "Give this person full admin access to the store?"}
                  className="btn-outline"
                >
                  {user.role === "admin" ? "Remove admin access" : "Make admin"}
                </ConfirmButton>
              </form>
            )}
          </section>
        </aside>
      </div>
    </>
  );
}
