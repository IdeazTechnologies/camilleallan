import { NextResponse, type NextRequest } from "next/server";
import { failOrder, findOrderByPsigateId, markOrderPaid, verifyOrderPayment } from "@/lib/orders";
import { parseHostedReturn } from "@/lib/payments/psigate";
import { rateLimit } from "@/lib/rate-limit";

/**
 * PSiGate sends the shopper back here (GET or POST) after the hosted payment page.
 * The returned fields are only hints: payment status always comes from the Order Verification API.
 */
async function handle(request: NextRequest, fields: URLSearchParams | FormData) {
  const url = request.nextUrl;
  const to = (path: string) => NextResponse.redirect(new URL(path, url), 303);

  const ip = request.headers.get("x-real-ip") ?? request.headers.get("x-forwarded-for")?.split(",")[0] ?? "unknown";
  if (!(await rateLimit(`psigate-return:${ip}`, 40, 15 * 60))) return to("/checkout?payment=error");

  const hint = parseHostedReturn(fields);
  if (!hint.orderId) return to("/checkout?payment=error");
  const order = await findOrderByPsigateId(hint.orderId);
  if (!order) return to("/checkout?payment=error");

  const complete = `/checkout/complete?${new URLSearchParams({ order: order.id, key: order.accessToken })}`;
  if (order.status !== "pending") return to(complete);

  const verification = await verifyOrderPayment(order);
  if (verification?.paid) {
    await markOrderPaid(order, verification);
    return to(complete);
  }

  const shopperSawDecline =
    url.searchParams.get("result") === "declined" || hint.approved === "DECLINED" || hint.approved === "ERROR";
  if (shopperSawDecline && verification && !verification.error) {
    await failOrder(order.id, `Payment declined at PSiGate${hint.errMsg ? `: ${hint.errMsg}` : ""}.`);
    return to("/checkout?payment=declined");
  }

  // Approved per the browser but not yet confirmed (or verification unavailable): keep it pending.
  // The confirmation page offers a re-check and the cron job reconciles later.
  if (verification?.error) console.warn(`[psigate] verification for ${order.psigateOrderId}: ${verification.error}`);
  return to(complete);
}

export async function GET(request: NextRequest) {
  return handle(request, request.nextUrl.searchParams);
}

export async function POST(request: NextRequest) {
  const form = await request.formData().catch(() => new FormData());
  // Some PSiGate configurations post fields while also appending them to the URL; merge both.
  for (const [k, v] of request.nextUrl.searchParams) if (!form.has(k)) form.set(k, v);
  return handle(request, form);
}
