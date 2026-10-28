import { desc, eq } from "drizzle-orm";
import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { statusTone } from "@/components/shop/OrderDetail";
import { Banners } from "@/components/site/Banners";
import { db } from "@/db";
import { newsletterSubscribers, orders, users } from "@/db/schema";
import { requireUser } from "@/lib/dal";
import { formatDate, formatMoney, ORDER_STATUS_LABELS } from "@/lib/utils";
import { PasswordResetForm, ProfileForm } from "./AccountForms";
import { AccountNav } from "./AccountNav";

export const metadata: Metadata = { title: "My account", robots: { index: false } };

async function AccountContent({ searchParams }: { searchParams: PageProps<"/account">["searchParams"] }) {
  const params = await searchParams;
  const user = await requireUser("/account");
  const [profile, orderList, subscriber] = await Promise.all([
    db.query.users.findFirst({ where: eq(users.id, user.id) }),
    db.query.orders.findMany({
      where: eq(orders.userId, user.id),
      orderBy: [desc(orders.createdAt)],
      limit: 100,
      columns: { id: true, number: true, status: true, totalCents: true, currency: true, createdAt: true },
    }),
    db.query.newsletterSubscribers.findFirst({ where: eq(newsletterSubscribers.email, user.email) }),
  ]);
  const visible = orderList.filter((o) => o.status !== "failed");

  return (
    <>
      {params.notice === "admin-only" && <p className="alert warning">That area is for store administrators only.</p>}
      <p className="muted" style={{ marginBottom: "var(--space-5)" }}>
        Signed in as <strong>{user.email}</strong>
        {user.role === "admin" && (
          <>
            {" "}
            · <Link href="/admin">Go to store admin</Link>
          </>
        )}
      </p>
      <AccountNav current="/account" />

      <div className="stack stack-lg">
        <section className="stack">
          <h2 style={{ fontSize: "var(--step-2)" }}>Your orders</h2>
          {visible.length === 0 ? (
            <p className="muted">
              You haven&apos;t placed any orders yet. <Link href="/shop">Visit the shop</Link>.
            </p>
          ) : (
            <div className="table-wrap">
              <table className="table">
                <thead>
                  <tr>
                    <th>Order</th>
                    <th>Date</th>
                    <th>Status</th>
                    <th className="num">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {visible.map((o) => (
                    <tr key={o.id}>
                      <td>
                        <Link href={`/account/orders/${o.id}`}>#{o.number}</Link>
                      </td>
                      <td>{formatDate(o.createdAt)}</td>
                      <td>
                        <span className={`badge ${statusTone(o.status)}`}>{ORDER_STATUS_LABELS[o.status] ?? o.status}</span>
                      </td>
                      <td className="num">{formatMoney(o.totalCents, o.currency)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <section className="card stack">
          <h2 style={{ fontSize: "var(--step-2)" }}>Your details</h2>
          <ProfileForm name={profile?.name ?? ""} phone={profile?.phone ?? ""} subscribed={subscriber?.status === "subscribed"} />
        </section>

        <section className="card stack">
          <h2 style={{ fontSize: "var(--step-2)" }}>Password</h2>
          <p className="muted">We’ll email you a link to choose a new password. It expires in 15 minutes.</p>
          <PasswordResetForm />
        </section>
      </div>
    </>
  );
}

export default function AccountPage({ searchParams }: PageProps<"/account">) {
  return (
    <div className="container" style={{ paddingBottom: "var(--space-8)" }}>
      <header className="page-header">
        <h1>My account</h1>
      </header>
      <Banners placement="account" className="mt-4" />
      <Suspense fallback={<div className="skeleton" style={{ height: 320 }} />}>
        <AccountContent searchParams={searchParams} />
      </Suspense>
    </div>
  );
}
