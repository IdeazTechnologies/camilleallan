import { asc, eq } from "drizzle-orm";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { Suspense } from "react";
import { SubmitButton } from "@/components/forms/SubmitButton";
import { OrderDetail } from "@/components/shop/OrderDetail";
import { Banners } from "@/components/site/Banners";
import { db } from "@/db";
import { orderItems, orders } from "@/db/schema";
import { getCurrentUser } from "@/lib/dal";
import { readSettingsFresh } from "@/lib/settings";
import { recheckPaymentAction } from "./actions";

export const metadata: Metadata = { title: "Order confirmation", robots: { index: false } };

async function CompleteContent({ searchParams }: { searchParams: PageProps<"/checkout/complete">["searchParams"] }) {
  const params = await searchParams;
  const id = typeof params.order === "string" ? params.order : "";
  const key = typeof params.key === "string" ? params.key : "";
  if (!id) notFound();
  await connection();

  const [order, user, settings] = await Promise.all([
    db.query.orders.findFirst({
      where: eq(orders.id, id),
      with: { items: { orderBy: [asc(orderItems.title)] }, shipments: true },
    }),
    getCurrentUser(),
    readSettingsFresh(),
  ]);
  const allowed = order && (order.accessToken === key || (user && (order.userId === user.id || user.role === "admin")));
  if (!order || !allowed) notFound();

  const heading =
    order.status === "pending"
      ? "We're confirming your payment"
      : order.status === "failed" || order.status === "cancelled"
        ? "This order was not completed"
        : "Thank you for your order!";

  return (
    <div className="stack stack-lg">
      <header className="stack stack-sm text-center" style={{ justifyItems: "center" }}>
        <p className="eyebrow">Order #{order.number}</p>
        <h1>{heading}</h1>
        {order.status === "pending" ? (
          <>
            <p className="lede">
              PSiGate hasn&apos;t confirmed this payment yet. This usually takes a moment. Your items stay reserved while we
              check.
            </p>
            <form action={recheckPaymentAction}>
              <input type="hidden" name="order" value={order.id} />
              <input type="hidden" name="key" value={order.accessToken} />
              <SubmitButton pendingLabel="Checking…">Check payment status</SubmitButton>
            </form>
          </>
        ) : order.status === "failed" || order.status === "cancelled" ? (
          <p className="lede">
            You have not been charged for this order. <Link href="/cart">Return to your cart</Link> to try again.
          </p>
        ) : (
          <p className="lede">
            A confirmation has been sent to <strong>{order.email}</strong>. We&apos;ll email you again when your order ships.
          </p>
        )}
      </header>

      {(order.status === "paid" || order.status === "fulfilled" || order.status === "shipped") && (
        <Banners placement="thank_you" />
      )}

      <div className="card">
        <OrderDetail order={order} taxLabel={settings.taxLabel} />
      </div>

      <p className="text-center">
        {user ? <Link href="/account">View your orders</Link> : <Link href="/login">Create an account or sign in</Link>} ·{" "}
        <Link href="/shop">Continue shopping</Link>
      </p>
    </div>
  );
}

export default function CompletePage({ searchParams }: PageProps<"/checkout/complete">) {
  return (
    <div className="container-narrow section-tight">
      <Suspense fallback={<div className="skeleton" style={{ height: 400 }} />}>
        <CompleteContent searchParams={searchParams} />
      </Suspense>
    </div>
  );
}
