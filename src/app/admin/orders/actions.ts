"use server";

import { eq } from "drizzle-orm";
import { refresh } from "next/cache";
import { createElement } from "react";
import { db } from "@/db";
import { orderEvents, orders, type OrderStatus } from "@/db/schema";
import { OrderConfirmationEmail } from "@/emails/OrderEmails";
import { audit } from "@/lib/audit";
import { requireAdmin } from "@/lib/dal";
import { sendEmail } from "@/lib/email/send";
import { checkbox, type ActionState } from "@/lib/forms";
import { addOrderNote, adminSetStatus, loadOrderForEmail, markOrderPaid, orderViewUrl, verifyOrderPayment } from "@/lib/orders";

const STATUSES: OrderStatus[] = ["pending", "paid", "fulfilled", "shipped", "cancelled", "refunded", "failed"];

export async function changeStatusAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const admin = await requireAdmin();
  const orderId = String(formData.get("orderId"));
  const to = STATUSES.find((s) => s === formData.get("to"));
  if (!to) return { ok: false, message: "Choose a status." };
  const opt = (k: string) => String(formData.get(k) ?? "").trim() || null;
  try {
    await adminSetStatus(orderId, to, admin.id, {
      notify: checkbox(formData, "notify"),
      restock: checkbox(formData, "restock"),
      shipment:
        to === "shipped"
          ? { carrier: opt("carrier"), trackingNumber: opt("trackingNumber"), trackingUrl: opt("trackingUrl") }
          : undefined,
    });
  } catch (err) {
    return { ok: false, message: err instanceof Error ? err.message : "Could not update the order." };
  }
  await audit(admin.id, "order.status", "order", orderId, { to });
  refresh();
  return { ok: true, message: `Order marked ${to}.` };
}

export async function addNoteAction(formData: FormData) {
  const admin = await requireAdmin();
  const message = String(formData.get("message") ?? "").trim();
  if (!message) return;
  await addOrderNote(String(formData.get("orderId")), message.slice(0, 4000), admin.id);
  refresh();
}

export async function saveAdminNoteAction(formData: FormData) {
  await requireAdmin();
  await db
    .update(orders)
    .set({ adminNote: String(formData.get("adminNote") ?? "").trim() || null })
    .where(eq(orders.id, String(formData.get("orderId"))));
  refresh();
}

export async function recheckPaymentAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const admin = await requireAdmin();
  const order = await db.query.orders.findFirst({ where: eq(orders.id, String(formData.get("orderId"))) });
  if (!order || order.status !== "pending") return { ok: false, message: "Only pending orders can be re-checked." };
  const verification = await verifyOrderPayment(order);
  if (!verification) return { ok: false, message: "PSiGate is not configured or this order has no payment reference." };
  if (verification.paid) {
    await markOrderPaid(order, verification);
    await audit(admin.id, "order.verify", "order", order.id, { result: "paid" });
    refresh();
    return { ok: true, message: "PSiGate confirmed the payment. The order is now paid." };
  }
  return {
    ok: false,
    message: `PSiGate reports status ${verification.status}${verification.error ? ` (${verification.error})` : ""}. Not marked paid.`,
  };
}

export async function resendConfirmationAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  await requireAdmin();
  const loaded = await loadOrderForEmail(String(formData.get("orderId")));
  if (!loaded) return { ok: false, message: "Order not found." };
  const result = await sendEmail({
    to: loaded.order.email,
    subject: `Order #${loaded.order.number} confirmation`,
    template: "order-confirmation",
    react: createElement(OrderConfirmationEmail, { order: loaded.emailOrder, orderUrl: orderViewUrl(loaded.order) }),
  });
  if (!result.ok) return { ok: false, message: "Email failed. See the email log." };
  await db.insert(orderEvents).values({ orderId: loaded.order.id, type: "email", message: "Confirmation re-sent by admin." });
  refresh();
  return { ok: true, message: `Confirmation sent to ${loaded.order.email}.` };
}
