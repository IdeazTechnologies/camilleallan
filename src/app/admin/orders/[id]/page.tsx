import { asc, desc, eq } from "drizzle-orm";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { OrderDetail } from "@/components/shop/OrderDetail";
import { AdminHeader } from "@/components/admin/ui";
import { db } from "@/db";
import { orderEvents, orderItems, orders } from "@/db/schema";
import { formatAddressLines } from "@/lib/address";
import { requireAdmin } from "@/lib/dal";
import { allowedTransitions } from "@/lib/orders";
import { readSettingsFresh } from "@/lib/settings";
import { formatDate } from "@/lib/utils";
import { addNoteAction, saveAdminNoteAction } from "../actions";
import { RecheckPaymentButton, ResendConfirmationButton, StatusForm } from "../OrderActions";

export const metadata: Metadata = { title: "Order" };

export default async function AdminOrderPage({ params }: PageProps<"/admin/orders/[id]">) {
  await requireAdmin();
  const { id } = await params;
  const [order, settings] = await Promise.all([
    db.query.orders.findFirst({
      where: eq(orders.id, id),
      with: {
        items: { orderBy: [asc(orderItems.title)] },
        shipments: true,
        events: { orderBy: [desc(orderEvents.createdAt)], with: { actor: { columns: { email: true, name: true } } } },
        user: { columns: { id: true, email: true, name: true } },
      },
    }),
    readSettingsFresh(),
  ]);
  if (!order) notFound();
  const billingDiffers = JSON.stringify(order.billingAddress) !== JSON.stringify(order.shippingAddress);

  return (
    <>
      <AdminHeader
        title={`Order #${order.number}`}
        back={{ href: "/admin/orders", label: "Orders" }}
        actions={
          <Link href={`/admin/orders/${order.id}/packing-slip`} target="_blank" className="btn btn-outline btn-sm">
            Packing slip
          </Link>
        }
      />
      <div className="split">
        <div className="stack stack-lg">
          <section className="card">
            <OrderDetail order={order} taxLabel={settings.taxLabel} />
          </section>
          {billingDiffers && order.billingAddress && (
            <section className="card stack stack-sm">
              <strong>Billing address</strong>
              <address style={{ fontStyle: "normal" }}>
                {formatAddressLines(order.billingAddress).map((l, i) => (
                  <div key={i}>{l}</div>
                ))}
              </address>
            </section>
          )}
          <section className="card stack">
            <h2 style={{ fontSize: "var(--step-1)" }}>History</h2>
            <form action={addNoteAction} className="cluster" style={{ flexWrap: "nowrap" }}>
              <input type="hidden" name="orderId" value={order.id} />
              <input className="input" name="message" placeholder="Add an internal note…" required />
              <button className="btn btn-outline btn-sm" type="submit">
                Add note
              </button>
            </form>
            <ol className="stack stack-sm" style={{ listStyle: "none", padding: 0 }}>
              {order.events.map((e) => (
                <li key={e.id} className="spread" style={{ alignItems: "baseline", borderBottom: "1px solid var(--color-border)", paddingBottom: "var(--space-2)" }}>
                  <span>
                    <span className="badge" style={{ marginRight: 8 }}>
                      {e.type}
                    </span>
                    {e.message}
                    {e.actor && <span className="muted"> by {e.actor.name ?? e.actor.email}</span>}
                  </span>
                  <span className="muted nowrap" style={{ fontSize: "var(--step--1)" }}>
                    {formatDate(e.createdAt, true)}
                  </span>
                </li>
              ))}
            </ol>
          </section>
        </div>

        <aside className="stack stack-lg">
          <section className="card stack">
            <h2 style={{ fontSize: "var(--step-1)" }}>Fulfillment</h2>
            <StatusForm orderId={order.id} current={order.status} allowed={allowedTransitions(order.status)} />
            {order.status === "pending" && <RecheckPaymentButton orderId={order.id} />}
            {order.status !== "pending" && order.status !== "failed" && <ResendConfirmationButton orderId={order.id} />}
          </section>
          <section className="card stack stack-sm">
            <h2 style={{ fontSize: "var(--step-1)" }}>Customer</h2>
            {order.user ? (
              <Link href={`/admin/customers/${order.user.id}`}>{order.user.name ?? order.user.email}</Link>
            ) : (
              <span className="muted">Guest checkout</span>
            )}
            <a href={`mailto:${order.email}?subject=${encodeURIComponent(`Your order #${order.number}`)}`}>{order.email}</a>
          </section>
          <section className="card stack stack-sm">
            <h2 style={{ fontSize: "var(--step-1)" }}>Payment</h2>
            <dl className="summary-list" style={{ fontSize: "var(--step--1)" }}>
              <div>
                <dt>Method</dt>
                <dd>{order.paymentMethod}</dd>
              </div>
              {order.psigateOrderId && (
                <div>
                  <dt>PSiGate order</dt>
                  <dd style={{ wordBreak: "break-all" }}>{order.psigateOrderId}</dd>
                </div>
              )}
              {order.psigateTransRef && (
                <div>
                  <dt>Transaction ref</dt>
                  <dd>{order.psigateTransRef}</dd>
                </div>
              )}
              {order.paidAt && (
                <div>
                  <dt>Paid</dt>
                  <dd>{formatDate(order.paidAt, true)}</dd>
                </div>
              )}
              {order.wooId && (
                <div>
                  <dt>WooCommerce #</dt>
                  <dd>{order.wooId}</dd>
                </div>
              )}
            </dl>
          </section>
          <section className="card stack stack-sm">
            <h2 style={{ fontSize: "var(--step-1)" }}>Private note</h2>
            <form action={saveAdminNoteAction} className="stack stack-sm">
              <input type="hidden" name="orderId" value={order.id} />
              <textarea className="input" name="adminNote" rows={3} defaultValue={order.adminNote ?? ""} />
              <button className="btn btn-outline btn-sm" type="submit" style={{ justifySelf: "start" }}>
                Save note
              </button>
            </form>
          </section>
        </aside>
      </div>
    </>
  );
}
