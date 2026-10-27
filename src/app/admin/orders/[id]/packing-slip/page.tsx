import { asc, eq } from "drizzle-orm";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { db } from "@/db";
import { orderItems, orders } from "@/db/schema";
import { formatAddressLines } from "@/lib/address";
import { requireAdmin } from "@/lib/dal";
import { readSettingsFresh } from "@/lib/settings";
import { formatDate } from "@/lib/utils";
import { PrintButton } from "./PrintButton";

export const metadata: Metadata = { title: "Packing slip" };

export default async function PackingSlip({ params }: PageProps<"/admin/orders/[id]/packing-slip">) {
  await requireAdmin();
  const { id } = await params;
  const [order, settings] = await Promise.all([
    db.query.orders.findFirst({ where: eq(orders.id, id), with: { items: { orderBy: [asc(orderItems.title)] } } }),
    readSettingsFresh(),
  ]);
  if (!order) notFound();
  return (
    <div className="card stack stack-lg" style={{ maxWidth: 720, background: "#fff" }}>
      <div className="spread">
        <div>
          <h1 style={{ fontSize: "var(--step-3)" }}>{settings.storeName}</h1>
          <p className="muted">{settings.contactEmail}</p>
        </div>
        <div style={{ textAlign: "right" }}>
          <strong>Order #{order.number}</strong>
          <p className="muted">{formatDate(order.createdAt)}</p>
        </div>
      </div>
      <div className="stack stack-sm">
        <strong>Ship to</strong>
        <address style={{ fontStyle: "normal", fontSize: "var(--step-1)" }}>
          {formatAddressLines(order.shippingAddress).map((l, i) => (
            <div key={i}>{l}</div>
          ))}
        </address>
      </div>
      <table className="table">
        <thead>
          <tr>
            <th>Item</th>
            <th>SKU</th>
            <th className="num">Qty</th>
          </tr>
        </thead>
        <tbody>
          {order.items.map((i) => (
            <tr key={i.id}>
              <td>{i.title}</td>
              <td>{i.sku ?? ""}</td>
              <td className="num">{i.quantity}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {order.customerNote && (
        <p>
          <strong>Customer note:</strong> {order.customerNote}
        </p>
      )}
      <p className="text-center" style={{ fontFamily: "var(--font-serif)", fontSize: "var(--step-1)" }}>
        Thank you for giving one of my babies a loving home. ♥ Camille
      </p>
      <PrintButton />
    </div>
  );
}
