"use server";

import { and, asc, eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import { z } from "zod";
import { db } from "@/db";
import { addresses, paymentSimulations, savedCards, shippingRules, type Address } from "@/db/schema";
import { parseAddress } from "@/lib/address";
import { getCart } from "@/lib/cart";
import { getCurrentUser } from "@/lib/dal";
import { checkbox, formValues, type ActionState } from "@/lib/forms";
import {
  CheckoutError,
  createPendingOrder,
  failOrder,
  markOrderPaid,
  releaseExpiredReservations,
  setPsigateOrderId,
  verifyOrderPayment,
} from "@/lib/orders";
import { buildHostedPaymentForm, chargeSavedCard, getPsigateConfig, newPsigateOrderId } from "@/lib/payments/psigate";
import { itemCountOf, shippingOptionsFor } from "@/lib/pricing";
import { clientIp, rateLimit } from "@/lib/rate-limit";
import { readSettingsFresh } from "@/lib/settings";
import { appUrl, normalizeEmail } from "@/lib/utils";

export type CheckoutState = ActionState & {
  redirectForm?: { action: string; method: "get" | "post"; fields: Record<string, string> };
};

const emailSchema = z.email("Please enter a valid email address.");

function completePath(order: { id: string; accessToken: string }) {
  return `/checkout/complete?${new URLSearchParams({ order: order.id, key: order.accessToken })}`;
}

function prefixed(errors: z.ZodError, prefix: string) {
  const out: Record<string, string> = {};
  for (const issue of errors.issues) {
    const key = `${prefix}${issue.path.join(".")}`;
    if (!out[key]) out[key] = issue.message;
  }
  return out;
}

export async function placeOrderAction(_prev: CheckoutState, formData: FormData): Promise<CheckoutState> {
  const values = formValues(formData);
  const fail = (message: string, errors?: Record<string, string>): CheckoutState => ({ ok: false, message, errors, values });

  const config = getPsigateConfig();
  if (!config) return fail("Online payment is temporarily unavailable. Please contact us to complete your order.");

  const ip = await clientIp();
  if (!(await rateLimit(`checkout:${ip}`, 15, 15 * 60))) {
    return fail("Too many checkout attempts. Please wait a few minutes and try again.");
  }

  const user = await getCurrentUser();
  const settings = await readSettingsFresh();
  const errors: Record<string, string> = {};

  const emailParsed = emailSchema.safeParse(normalizeEmail(user?.email ?? String(formData.get("email") ?? "")));
  if (!emailParsed.success) errors.email = emailParsed.error.issues[0].message;

  const shipping = parseAddress(formData, "ship_");
  if (!shipping.success) Object.assign(errors, prefixed(shipping.error, "ship_"));

  const billingSame = checkbox(formData, "billingSame");
  const billing = billingSame ? shipping : parseAddress(formData, "bill_");
  if (!billingSame && !billing.success) Object.assign(errors, prefixed(billing.error, "bill_"));

  if (shipping.success && settings.shipToCountries.length > 0 && !settings.shipToCountries.includes(shipping.data.country)) {
    errors.ship_country = "Sorry, we don't ship to that country.";
  }
  if (Object.keys(errors).length > 0 || !shipping.success || !billing.success || !emailParsed.success) {
    return fail("Please check the highlighted fields.", errors);
  }

  await releaseExpiredReservations(10);
  const cart = await getCart();
  if (!cart || cart.lines.length === 0) return fail("Your cart is empty.");
  if (cart.hasProblems) return fail("Some items in your cart are no longer available. Please review your cart.");

  const rules = await db.query.shippingRules.findMany({
    where: eq(shippingRules.active, true),
    orderBy: [asc(shippingRules.sortOrder)],
  });
  const purchasable = cart.lines.filter((l) => l.available);
  const options = shippingOptionsFor(rules, {
    country: shipping.data.country,
    subtotalCents: cart.subtotalCents,
    itemCount: itemCountOf(purchasable),
  });
  const chosen = options.find((o) => o.id === formData.get("shippingRuleId")) ?? (options.length === 1 ? options[0] : null);
  if (!chosen) {
    return options.length === 0
      ? fail("Sorry, we can't ship this order to the selected country. Please contact us.", { ship_country: "No shipping available." })
      : fail("Please choose a shipping method.", { shippingRuleId: "Please choose a shipping method." });
  }

  const savedCardId = String(formData.get("savedCardId") ?? "");
  const savedCard =
    savedCardId && savedCardId !== "new" && user && config.savedCardsEnabled
      ? await db.query.savedCards.findFirst({ where: and(eq(savedCards.id, savedCardId), eq(savedCards.userId, user.id)) })
      : null;
  if (savedCardId && savedCardId !== "new" && !savedCard) return fail("That saved card is no longer available.");

  const shippingAddress: Address = shipping.data;
  const billingAddress: Address = billing.data;

  let order;
  try {
    order = await createPendingOrder({
      cart,
      userId: user?.id ?? null,
      email: emailParsed.data,
      shippingAddress,
      billingAddress,
      shipping: { ruleId: chosen.id, name: chosen.name, costCents: chosen.costCents },
      customerNote: String(formData.get("customerNote") ?? "").trim().slice(0, 2000) || null,
      saveCard: !!user && config.savedCardsEnabled && !savedCard && checkbox(formData, "saveCard"),
      newsletterOptIn: checkbox(formData, "newsletter"),
      paymentMethod: savedCard ? "psigate_saved" : "psigate",
    });
  } catch (err) {
    if (err instanceof CheckoutError) return fail(err.message);
    console.error("[checkout] createPendingOrder failed", err);
    return fail("We couldn't place your order. Please try again.");
  }

  if (user && checkbox(formData, "saveAddress")) {
    const existing = await db.query.addresses.findFirst({ where: eq(addresses.userId, user.id) });
    await db.insert(addresses).values({ userId: user.id, ...shippingAddress, isDefault: !existing });
  }

  const psigateOrderId = newPsigateOrderId(order.number);
  await setPsigateOrderId(order.id, psigateOrderId);
  const paidOrder = { ...order, psigateOrderId };

  if (savedCard) {
    if (config.mode === "simulate") {
      await db.insert(paymentSimulations).values({ psigateOrderId, approved: true, totalCents: order.totalCents });
    }
    const charge = await chargeSavedCard(config, {
      psigateOrderId,
      preOrderId: savedCard.psigateOrderId,
      totalCents: order.totalCents,
      email: order.email,
      orderNumber: order.number,
    });
    const verification = charge.approved ? await verifyOrderPayment(paidOrder) : null;
    if (verification?.paid) {
      await markOrderPaid(paidOrder, verification);
      redirect(completePath(order));
    }
    await failOrder(order.id, `Saved card payment declined: ${charge.error ?? verification?.error ?? "not approved"}`);
    return fail(`Your saved card was declined${charge.error ? ` (${charge.error})` : ""}. Please try another card.`);
  }

  const form = buildHostedPaymentForm(config, {
    psigateOrderId,
    totalCents: order.totalCents,
    orderNumber: order.number,
    email: order.email,
    customerIp: ip,
    billing: billingAddress,
    thanksUrl: appUrl("/api/psigate/return?result=approved"),
    noThanksUrl: appUrl("/api/psigate/return?result=declined"),
  });
  return {
    ok: true,
    message: "Redirecting to our secure payment page…",
    redirectForm: { action: form.action, method: config.mode === "simulate" ? "get" : "post", fields: form.fields },
  };
}
