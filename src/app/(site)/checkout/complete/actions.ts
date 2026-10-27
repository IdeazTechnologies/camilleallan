"use server";

import { and, eq } from "drizzle-orm";
import { refresh } from "next/cache";
import { db } from "@/db";
import { orders } from "@/db/schema";
import { markOrderPaid, verifyOrderPayment } from "@/lib/orders";
import { clientIp, rateLimit } from "@/lib/rate-limit";

/** Lets a shopper re-check a payment PSiGate hasn't confirmed yet. */
export async function recheckPaymentAction(formData: FormData) {
  const id = String(formData.get("order") ?? "");
  const key = String(formData.get("key") ?? "");
  if (!(await rateLimit(`recheck:${await clientIp()}`, 10, 10 * 60))) return;
  const order = await db.query.orders.findFirst({ where: and(eq(orders.id, id), eq(orders.accessToken, key)) });
  if (order?.status === "pending" && order.psigateOrderId) {
    const verification = await verifyOrderPayment(order);
    if (verification?.paid) await markOrderPaid(order, verification);
  }
  refresh();
}
