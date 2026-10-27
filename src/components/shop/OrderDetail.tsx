import type { orderItems, orders, shipments } from "@/db/schema";
import { formatAddressLines } from "@/lib/address";
import { formatDate, formatMoney, ORDER_STATUS_LABELS } from "@/lib/utils";

type Props = {
  order: typeof orders.$inferSelect & {
    items: (typeof orderItems.$inferSelect)[];
    shipments?: (typeof shipments.$inferSelect)[];
  };
  taxLabel: string;
};

export function statusTone(status: string) {
  return status === "paid" || status === "fulfilled"
    ? "accent"
    : status === "shipped"
      ? "success"
      : status === "pending"
        ? "warning"
        : status === "cancelled" || status === "failed" || status === "refunded"
          ? "danger"
          : "";
}

export function OrderDetail({ order, taxLabel }: Props) {
  const money = (c: number) => formatMoney(c, order.currency);
  return (
    <div className="stack stack-lg">
      <div className="spread">
        <div className="stack stack-sm">
          <h2 style={{ fontSize: "var(--step-2)" }}>Order #{order.number}</h2>
          <span className="muted">Placed {formatDate(order.createdAt, true)}</span>
        </div>
        <span className={`badge ${statusTone(order.status)}`}>{ORDER_STATUS_LABELS[order.status] ?? order.status}</span>
      </div>

      {order.shipments && order.shipments.length > 0 && (
        <div className="panel stack stack-sm">
          <strong>Shipping updates</strong>
          {order.shipments.map((s) => (
            <p key={s.id}>
              Shipped {formatDate(s.shippedAt)}
              {s.carrier && ` via ${s.carrier}`}
              {s.trackingNumber && (
                <>
                  {" "}
                  · Tracking{" "}
                  {s.trackingUrl ? (
                    <a href={s.trackingUrl} target="_blank" rel="noopener noreferrer">
                      {s.trackingNumber}
                    </a>
                  ) : (
                    s.trackingNumber
                  )}
                </>
              )}
            </p>
          ))}
        </div>
      )}

      <div className="table-wrap">
        <table className="table">
          <thead>
            <tr>
              <th>Item</th>
              <th className="num">Qty</th>
              <th className="num">Price</th>
              <th className="num">Total</th>
            </tr>
          </thead>
          <tbody>
            {order.items.map((i) => (
              <tr key={i.id}>
                <td>{i.title}</td>
                <td className="num">{i.quantity}</td>
                <td className="num">{money(i.unitPriceCents)}</td>
                <td className="num">{money(i.unitPriceCents * i.quantity)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <dl className="summary-list" style={{ maxWidth: 360, marginLeft: "auto", width: "100%" }}>
        <div>
          <dt>Subtotal</dt>
          <dd>{money(order.subtotalCents)}</dd>
        </div>
        <div>
          <dt>Shipping{order.shippingMethod ? ` (${order.shippingMethod})` : ""}</dt>
          <dd>{order.shippingCents === 0 ? "Free" : money(order.shippingCents)}</dd>
        </div>
        {order.taxCents > 0 && (
          <div>
            <dt>{taxLabel}</dt>
            <dd>{money(order.taxCents)}</dd>
          </div>
        )}
        <div className="total">
          <dt>Total</dt>
          <dd>
            {money(order.totalCents)} {order.currency}
          </dd>
        </div>
      </dl>

      <div className="form-row">
        <div className="stack stack-sm">
          <strong>Shipping to</strong>
          <address style={{ fontStyle: "normal" }}>
            {formatAddressLines(order.shippingAddress).map((l, i) => (
              <div key={i}>{l}</div>
            ))}
          </address>
        </div>
        <div className="stack stack-sm">
          <strong>Payment</strong>
          <p>
            {order.cardType || order.cardLast4
              ? `${order.cardType ?? "Card"}${order.cardLast4 ? ` ending ${order.cardLast4}` : ""}`
              : order.paymentMethod === "psigate" || order.paymentMethod === "psigate_saved"
                ? "Credit card (PSiGate)"
                : order.paymentMethod}
          </p>
          <p className="muted">{order.email}</p>
        </div>
      </div>
      {order.customerNote && (
        <div className="stack stack-sm">
          <strong>Your note</strong>
          <p style={{ whiteSpace: "pre-line" }}>{order.customerNote}</p>
        </div>
      )}
    </div>
  );
}
