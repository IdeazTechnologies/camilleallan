import "server-only";
import { and, asc, eq, isNotNull, lt, sql } from "drizzle-orm";
import { revalidateTag } from "next/cache";
import { createElement } from "react";
import { db, type Transaction } from "@/db";
import {
  newsletterSubscribers,
  orderEvents,
  orderItems,
  orders,
  paymentSimulations,
  products,
  savedCards,
  shipments,
  type Address,
  type OrderStatus,
} from "@/db/schema";
import { AdminNewOrderEmail, OrderConfirmationEmail, OrderShippedEmail, OrderStatusEmail } from "@/emails/OrderEmails";
import type { EmailOrder } from "@/emails/OrderSummaryBlock";
import { TAGS } from "@/lib/catalog";
import { clearCart, type Cart } from "@/lib/cart";
import { adminNotifyEmail, sendEmail } from "@/lib/email/send";
import { getPsigateConfig, verifyPayment, type VerificationResult } from "@/lib/payments/psigate";
import { computeTotals } from "@/lib/pricing";
import { readSettingsFresh } from "@/lib/settings";
import { appUrl } from "@/lib/utils";

export const RESERVATION_MINUTES = 30;

export class CheckoutError extends Error {}

export type Order = typeof orders.$inferSelect;
type OrderWithItems = Order & { items: (typeof orderItems.$inferSelect)[] };

export function orderViewUrl(order: Pick<Order, "id" | "accessToken">) {
  return appUrl(`/checkout/complete?order=${order.id}&key=${order.accessToken}`);
}

async function addEvent(
  tx: Transaction | typeof db,
  orderId: string,
  type: "status" | "note" | "email" | "payment",
  message: string,
  extra: { fromStatus?: string; toStatus?: string; actorUserId?: string | null } = {},
) {
  await tx.insert(orderEvents).values({ orderId, type, message, ...extra });
}

async function restock(tx: Transaction, orderId: string) {
  const items = await tx.query.orderItems.findMany({ where: eq(orderItems.orderId, orderId) });
  for (const item of items) {
    if (!item.productId) continue;
    await tx
      .update(products)
      .set({ stockQty: sql`${products.stockQty} + ${item.quantity}` })
      .where(eq(products.id, item.productId));
  }
}

function invalidateCatalog() {
  revalidateTag(TAGS.catalog, { expire: 0 });
}

export type CreateOrderInput = {
  cart: Cart;
  userId: string | null;
  email: string;
  shippingAddress: Address;
  billingAddress: Address;
  shipping: { ruleId: string; name: string; costCents: number };
  customerNote: string | null;
  saveCard: boolean;
  newsletterOptIn: boolean;
  paymentMethod: "psigate" | "psigate_saved";
};

/** Creates a pending order and reserves stock atomically. Throws CheckoutError for customer-facing problems. */
export async function createPendingOrder(input: CreateOrderInput) {
  const settings = await readSettingsFresh();
  const lines = input.cart.lines.filter((l) => l.available);
  if (lines.length === 0) throw new CheckoutError("Your cart is empty.");
  if (input.cart.hasProblems) throw new CheckoutError("Some items in your cart are no longer available.");

  const totals = computeTotals(lines, input.shipping.costCents, {
    ratePercent: settings.taxRatePercent,
    includeShipping: settings.taxShipping,
  });

  return db.transaction(async (tx) => {
    for (const line of lines) {
      const updated = await tx
        .update(products)
        .set({ stockQty: sql`${products.stockQty} - ${line.quantity}` })
        .where(
          and(
            eq(products.id, line.productId),
            eq(products.status, "published"),
            sql`${products.stockQty} >= ${line.quantity}`,
          ),
        )
        .returning({ id: products.id });
      if (updated.length === 0) throw new CheckoutError(`Sorry, "${line.title}" just sold out.`);
    }

    const [order] = await tx
      .insert(orders)
      .values({
        userId: input.userId,
        cartId: input.cart.id,
        email: input.email,
        status: "pending",
        currency: settings.currency,
        subtotalCents: totals.subtotalCents,
        shippingCents: totals.shippingCents,
        taxCents: totals.taxCents,
        totalCents: totals.totalCents,
        shippingRuleId: input.shipping.ruleId,
        shippingMethod: input.shipping.name,
        shippingAddress: input.shippingAddress,
        billingAddress: input.billingAddress,
        customerNote: input.customerNote,
        saveCard: input.saveCard,
        newsletterOptIn: input.newsletterOptIn,
        paymentMethod: input.paymentMethod,
        reservedUntil: new Date(Date.now() + RESERVATION_MINUTES * 60_000),
      })
      .returning();

    await tx.insert(orderItems).values(
      lines.map((l) => ({
        orderId: order.id,
        productId: l.productId,
        title: l.title,
        sku: l.sku,
        imageUrl: l.imageUrl,
        unitPriceCents: l.unitPriceCents,
        quantity: l.quantity,
      })),
    );
    await addEvent(tx, order.id, "status", "Order created, awaiting payment.", { toStatus: "pending" });
    return order;
  });
}

export async function setPsigateOrderId(orderId: string, psigateOrderId: string) {
  await db.update(orders).set({ psigateOrderId }).where(eq(orders.id, orderId));
}

export async function findOrderByPsigateId(psigateOrderId: string) {
  return db.query.orders.findFirst({ where: eq(orders.psigateOrderId, psigateOrderId) });
}

export async function lookupSimulation(psigateOrderId: string) {
  const sim = await db.query.paymentSimulations.findFirst({
    where: eq(paymentSimulations.psigateOrderId, psigateOrderId),
  });
  return sim ? { approved: sim.approved, totalCents: sim.totalCents } : null;
}

/** Looks up an order's payment with PSiGate's Order Verification API (or simulated payment records). */
export async function verifyOrderPayment(order: Order): Promise<VerificationResult | null> {
  const config = getPsigateConfig();
  if (!config || !order.psigateOrderId) return null;
  return verifyPayment(config, order.psigateOrderId, order.totalCents, lookupSimulation);
}

/**
 * Marks an order paid. Idempotent: only the first caller transitions it, and only that caller
 * triggers emails and side effects.
 */
export async function markOrderPaid(order: Order, payment: VerificationResult) {
  const updated = await db.transaction(async (tx) => {
    const [row] = await tx
      .update(orders)
      .set({
        status: "paid",
        paidAt: new Date(),
        reservedUntil: null,
        psigateTransRef: payment.transRef,
        cardType: payment.cardType,
        cardLast4: payment.last4,
      })
      .where(and(eq(orders.id, order.id), eq(orders.status, "pending")))
      .returning();
    if (!row) return null;
    await addEvent(
      tx,
      order.id,
      "payment",
      `Payment confirmed by PSiGate (${payment.status}${payment.last4 ? `, card ending ${payment.last4}` : ""}).`,
      { fromStatus: "pending", toStatus: "paid" },
    );
    return row;
  });
  if (!updated) return false;

  if (updated.cartId) await clearCart(updated.cartId);
  invalidateCatalog();
  await afterPaid(updated, payment);
  return true;
}

async function afterPaid(order: Order, payment: VerificationResult) {
  const config = getPsigateConfig();
  if (order.saveCard && order.userId && order.psigateOrderId && config?.savedCardsEnabled) {
    await db.insert(savedCards).values({
      userId: order.userId,
      psigateOrderId: order.psigateOrderId,
      cardType: payment.cardType,
      last4: payment.last4,
      expMonth: payment.expMonth,
      expYear: payment.expYear,
    });
  }
  if (order.newsletterOptIn) {
    await db
      .insert(newsletterSubscribers)
      .values({ email: order.email, status: "subscribed", source: "checkout", userId: order.userId, confirmedAt: new Date() })
      .onConflictDoUpdate({
        target: newsletterSubscribers.email,
        set: { status: "subscribed", confirmedAt: new Date(), unsubscribedAt: null },
      });
  }
  await sendPaidEmails(order.id);
}

export async function loadOrderForEmail(orderId: string) {
  const order = await db.query.orders.findFirst({
    where: eq(orders.id, orderId),
    with: { items: { orderBy: [asc(orderItems.title)] } },
  });
  if (!order) return null;
  const settings = await readSettingsFresh();
  return { order, emailOrder: toEmailOrder(order, settings.taxLabel), settings };
}

export function toEmailOrder(order: OrderWithItems, taxLabel: string): EmailOrder {
  return {
    number: order.number,
    currency: order.currency,
    items: order.items.map((i) => ({ title: i.title, quantity: i.quantity, unitPriceCents: i.unitPriceCents })),
    subtotalCents: order.subtotalCents,
    shippingCents: order.shippingCents,
    taxCents: order.taxCents,
    totalCents: order.totalCents,
    taxLabel,
    shippingMethod: order.shippingMethod,
    shippingAddress: order.shippingAddress ?? null,
    email: order.email,
    customerNote: order.customerNote,
  };
}

async function sendPaidEmails(orderId: string) {
  const loaded = await loadOrderForEmail(orderId);
  if (!loaded) return;
  const { order, emailOrder, settings } = loaded;
  await sendEmail({
    to: order.email,
    subject: `Order #${order.number} confirmed. Thank you!`,
    template: "order-confirmation",
    react: createElement(OrderConfirmationEmail, { order: emailOrder, orderUrl: orderViewUrl(order) }),
  });
  await sendEmail({
    to: adminNotifyEmail(settings.contactEmail),
    subject: `New order #${order.number}`,
    template: "admin-new-order",
    react: createElement(AdminNewOrderEmail, { order: emailOrder, adminUrl: appUrl(`/admin/orders/${order.id}`) }),
    replyTo: order.email,
  });
  await addEvent(db, order.id, "email", "Order confirmation sent to customer.");
}

/** Payment declined or abandoned: release the reserved stock so others can buy it. */
export async function failOrder(orderId: string, reason: string, status: "failed" | "cancelled" = "failed") {
  const changed = await db.transaction(async (tx) => {
    const [row] = await tx
      .update(orders)
      .set({ status, reservedUntil: null, cancelledAt: status === "cancelled" ? new Date() : null })
      .where(and(eq(orders.id, orderId), eq(orders.status, "pending")))
      .returning({ id: orders.id });
    if (!row) return false;
    await restock(tx, orderId);
    await addEvent(tx, orderId, "status", reason, { fromStatus: "pending", toStatus: status });
    return true;
  });
  if (changed) invalidateCatalog();
  return changed;
}

/**
 * Pending orders past their reservation: confirm with PSiGate first (the customer may have paid but
 * never returned to the site), otherwise cancel and restock.
 */
export async function releaseExpiredReservations(limit = 20) {
  const expired = await db.query.orders.findMany({
    where: and(eq(orders.status, "pending"), isNotNull(orders.reservedUntil), lt(orders.reservedUntil, new Date())),
    limit,
  });
  let paid = 0;
  let cancelled = 0;
  for (const order of expired) {
    const verification = order.psigateOrderId ? await verifyOrderPayment(order) : null;
    if (verification?.paid) {
      if (await markOrderPaid(order, verification)) paid++;
    } else if (await failOrder(order.id, "Reservation expired without payment.", "cancelled")) {
      cancelled++;
    }
  }
  return { checked: expired.length, paid, cancelled };
}

const ADMIN_TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
  pending: ["cancelled"],
  paid: ["fulfilled", "shipped", "cancelled", "refunded"],
  fulfilled: ["shipped", "paid", "cancelled", "refunded"],
  shipped: ["refunded", "fulfilled"],
  cancelled: [],
  refunded: [],
  failed: [],
};

export function allowedTransitions(status: OrderStatus) {
  return ADMIN_TRANSITIONS[status] ?? [];
}

export async function adminSetStatus(
  orderId: string,
  to: OrderStatus,
  actorUserId: string,
  opts: { restock?: boolean; notify?: boolean; shipment?: { carrier: string | null; trackingNumber: string | null; trackingUrl: string | null } } = {},
) {
  const current = await db.query.orders.findFirst({ where: eq(orders.id, orderId) });
  if (!current) throw new Error("Order not found");
  if (!allowedTransitions(current.status).includes(to)) {
    throw new Error(`Cannot change an order from ${current.status} to ${to}`);
  }

  await db.transaction(async (tx) => {
    const now = new Date();
    await tx
      .update(orders)
      .set({
        status: to,
        reservedUntil: null,
        ...(to === "fulfilled" ? { fulfilledAt: now } : {}),
        ...(to === "shipped" ? { shippedAt: now } : {}),
        ...(to === "cancelled" ? { cancelledAt: now } : {}),
      })
      .where(eq(orders.id, orderId));
    if (to === "shipped" && opts.shipment) {
      await tx.insert(shipments).values({ orderId, ...opts.shipment, shippedAt: now });
    }
    if ((to === "cancelled" || to === "refunded") && (opts.restock || current.status === "pending")) {
      await restock(tx, orderId);
    }
    await addEvent(tx, orderId, "status", `Status changed to ${to}.`, {
      fromStatus: current.status,
      toStatus: to,
      actorUserId,
    });
  });
  if (to === "cancelled" || to === "refunded") invalidateCatalog();

  if (opts.notify) await notifyStatusChange(orderId, to, opts.shipment);
}

async function notifyStatusChange(
  orderId: string,
  to: OrderStatus,
  shipment?: { carrier: string | null; trackingNumber: string | null; trackingUrl: string | null },
) {
  const loaded = await loadOrderForEmail(orderId);
  if (!loaded) return;
  const { order, emailOrder } = loaded;
  const orderUrl = orderViewUrl(order);
  if (to === "shipped") {
    await sendEmail({
      to: order.email,
      subject: `Order #${order.number} has shipped`,
      template: "order-shipped",
      react: createElement(OrderShippedEmail, { order: emailOrder, orderUrl, ...shipment }),
    });
  } else if (to === "cancelled" || to === "refunded") {
    const headline = to === "cancelled" ? "Your order was cancelled" : "Your order was refunded";
    const message =
      to === "cancelled"
        ? `Order #${order.number} has been cancelled. If you were charged, the refund will appear on your card within a few business days.`
        : `A refund for order #${order.number} has been issued to your original payment card. It can take a few business days to appear.`;
    await sendEmail({
      to: order.email,
      subject: `${headline} (#${order.number})`,
      template: `order-${to}`,
      react: createElement(OrderStatusEmail, { order: emailOrder, orderUrl, headline, message }),
    });
  } else {
    return;
  }
  await addEvent(db, orderId, "email", `Customer notified: ${to}.`);
}

export async function addOrderEvent(orderId: string, type: "note" | "payment", message: string) {
  await addEvent(db, orderId, type, message);
}

export async function addOrderNote(orderId: string, message: string, actorUserId: string) {
  await addEvent(db, orderId, "note", message, { actorUserId });
}