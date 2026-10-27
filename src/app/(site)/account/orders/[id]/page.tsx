import { and, asc, eq } from "drizzle-orm";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { OrderDetail } from "@/components/shop/OrderDetail";
import { db } from "@/db";
import { orderItems, orders } from "@/db/schema";
import { requireUser } from "@/lib/dal";
import { readSettingsFresh } from "@/lib/settings";

export const metadata: Metadata = { title: "Order details", robots: { index: false } };

async function OrderContent({ params }: { params: PageProps<"/account/orders/[id]">["params"] }) {
  const { id } = await params;
  const user = await requireUser(`/account/orders/${id}`);
  const [order, settings] = await Promise.all([
    db.query.orders.findFirst({
      where: and(eq(orders.id, id), eq(orders.userId, user.id)),
      with: { items: { orderBy: [asc(orderItems.title)] }, shipments: true },
    }),
    readSettingsFresh(),
  ]);
  if (!order) notFound();
  return (
    <div className="card">
      <OrderDetail order={order} taxLabel={settings.taxLabel} />
    </div>
  );
}

export default function AccountOrderPage({ params }: PageProps<"/account/orders/[id]">) {
  return (
    <div className="container-narrow" style={{ paddingBottom: "var(--space-8)" }}>
      <header className="page-header">
        <Link href="/account">← Back to my account</Link>
      </header>
      <Suspense fallback={<div className="skeleton" style={{ height: 400 }} />}>
        <OrderContent params={params} />
      </Suspense>
    </div>
  );
}
