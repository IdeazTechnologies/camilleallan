import { centsToDecimal, decimalToCents } from "@/lib/pricing";

/**
 * PSiGate integration (Real-time XML API, StoreID + Passphrase):
 *  - New cards: the checkout form posts the card to our server action, which sends a Sale to PSiGate and
 *    discards the card details. Card numbers, expiry and CVV are never stored, logged or echoed back.
 *  - Saved cards: recharge a previous PSiGate order with PreOrderID.
 *  - The Order Verification API is a fallback for orders whose charge outcome is unknown (e.g. a timeout).
 */

export type PsigateMode = "test" | "live" | "simulate";

export type PsigateConfig = {
  mode: PsigateMode;
  storeId: string;
  passphrase: string;
  xmlUrl: string;
  verifyUrl: string;
  savedCardsEnabled: boolean;
};

const ENDPOINTS = {
  test: {
    xml: "https://realtimestaging.psigate.com/xml",
    verify: "https://realtimestaging.psigate.com/verify/json",
  },
  live: {
    xml: "https://realtime.psigate.com/xml",
    verify: "https://realtime.psigate.com/verify/json",
  },
};

/** In simulate mode, a card ending in this number is declined; any other valid card is approved. */
export const SIMULATED_DECLINE_CARD = "4000000000000002";

export function getPsigateConfig(env: Record<string, string | undefined> = process.env): PsigateConfig | null {
  const requested = (env.PSIGATE_MODE ?? "").toLowerCase();
  if (requested === "simulate") {
    if (env.VERCEL_ENV === "production") return null;
    return {
      mode: "simulate",
      storeId: "simulator",
      passphrase: "",
      xmlUrl: "",
      verifyUrl: "",
      savedCardsEnabled: env.PSIGATE_SAVED_CARDS === "true",
    };
  }
  const mode: PsigateMode = requested === "live" ? "live" : "test";
  const storeId = env.PSIGATE_STORE_ID ?? "";
  const passphrase = env.PSIGATE_PASSPHRASE ?? "";
  if (!storeId || !passphrase) return null;
  const e = ENDPOINTS[mode];
  return {
    mode,
    storeId,
    passphrase,
    xmlUrl: env.PSIGATE_XML_URL || e.xml,
    verifyUrl: env.PSIGATE_VERIFY_URL || e.verify,
    savedCardsEnabled: env.PSIGATE_SAVED_CARDS === "true",
  };
}

export type CardDetails = { number: string; expMonth: string; expYear: string; cvv: string };

/** Card number by Luhn checksum; expiry as MM/YY or MM/YYYY and not in the past; 3–4 digit CVV. */
export function parseCardInput(
  raw: { number: string; expiry: string; cvv: string },
  now = new Date(),
): { ok: true; card: CardDetails } | { ok: false; errors: Record<string, string> } {
  const errors: Record<string, string> = {};
  const number = raw.number.replace(/[\s-]/g, "");
  if (!/^\d{13,19}$/.test(number) || !luhn(number)) errors.cardNumber = "Please check your card number.";
  else if (!cardBrand(number)) errors.cardNumber = "Sorry, we accept Visa and Mastercard only.";

  const exp = raw.expiry.replace(/\s/g, "").match(/^(\d{1,2})\/?(\d{2}|\d{4})$/);
  const month = exp ? Number(exp[1]) : 0;
  const year = exp ? Number(exp[2].length === 4 ? exp[2] : `20${exp[2]}`) : 0;
  if (!exp || month < 1 || month > 12) errors.cardExpiry = "Enter the expiry date as MM/YY.";
  else if (year < now.getFullYear() || (year === now.getFullYear() && month < now.getMonth() + 1)) {
    errors.cardExpiry = "This card has expired.";
  }

  const cvv = raw.cvv.trim();
  if (!/^\d{3,4}$/.test(cvv)) errors.cardCvv = "Enter the 3 or 4 digit security code.";

  if (Object.keys(errors).length > 0) return { ok: false, errors };
  return {
    ok: true,
    card: { number, expMonth: String(month).padStart(2, "0"), expYear: String(year % 100).padStart(2, "0"), cvv },
  };
}

/** The PSiGate account accepts Visa and Mastercard only. */
export function cardBrand(number: string): "visa" | "mastercard" | null {
  if (/^4\d{12}(\d{3}){0,2}$/.test(number)) return "visa";
  const prefix = Number(number.slice(0, 4));
  if (number.length === 16 && (/^5[1-5]/.test(number) || (prefix >= 2221 && prefix <= 2720))) return "mastercard";
  return null;
}

function luhn(digits: string) {
  let sum = 0;
  for (let i = 0; i < digits.length; i++) {
    let d = Number(digits[digits.length - 1 - i]);
    if (i % 2 === 1) {
      d *= 2;
      if (d > 9) d -= 9;
    }
    sum += d;
  }
  return sum % 10 === 0;
}

/** PSiGate OrderIDs must be unique per store, so each payment attempt gets a fresh one. */
export function newPsigateOrderId(orderNumber: number) {
  const suffix = crypto.randomUUID().replaceAll("-", "").slice(0, 10).toUpperCase();
  return `CA${orderNumber}-${suffix}`;
}

export type BillingInfo = {
  name: string;
  line1: string;
  line2?: string | null;
  city: string;
  region: string;
  postalCode: string;
  country: string;
  phone?: string | null;
};

export type SaleInput = {
  psigateOrderId: string;
  totalCents: number;
  orderNumber: number;
  email: string;
  customerIp?: string;
  billing?: BillingInfo;
} & ({ card: CardDetails; preOrderId?: never } | { preOrderId: string; card?: never });

/** Strips characters PSiGate rejects (e.g. "&") and trims to a field length. */
function clean(value: string | null | undefined, max = 64) {
  return (value ?? "").replace(/[&<>"]/g, " ").replace(/\s+/g, " ").trim().slice(0, max);
}

export type VerificationResult = {
  paid: boolean;
  status: string;
  amountCents: number | null;
  transRef: string | null;
  cardType: string | null;
  last4: string | null;
  expMonth: string | null;
  expYear: string | null;
  error: string | null;
};

type VerifyResponse = {
  ResponseCode?: string;
  OrderStatus?: string;
  OrderID?: string;
  TransactionRefNumber?: string;
  OrderPaymentCardInfo?: { CardNumber?: string; CardExpMonth?: string; CardExpYear?: string; CardType?: string };
  OrderAmountInfo?: { FullTotal?: number | string; SubTotal?: number | string };
};

export function last4Of(cardNumber: string | null | undefined) {
  const digits = (cardNumber ?? "").replace(/\D/g, "");
  return digits.length >= 4 ? digits.slice(-4) : null;
}

/** Interprets an Order Verification API response for a specific expected amount. */
export function evaluateVerification(
  response: VerifyResponse,
  expectedOrderId: string,
  expectedCents: number,
): VerificationResult {
  const status = (response.OrderStatus ?? "UNKNOWN").trim().toUpperCase();
  const code = (response.ResponseCode ?? "").trim().toUpperCase();
  const amountCents = decimalToCents(response.OrderAmountInfo?.FullTotal ?? null);
  const card = response.OrderPaymentCardInfo ?? {};
  const base = {
    status,
    amountCents,
    transRef: response.TransactionRefNumber ?? null,
    cardType: card.CardType?.trim() || null,
    last4: last4Of(card.CardNumber),
    expMonth: card.CardExpMonth ?? null,
    expYear: card.CardExpYear ?? null,
  };
  if (code !== "PSI-0000" && code !== "OK") {
    return { ...base, paid: false, error: `Verification response ${code || "missing"}` };
  }
  if (response.OrderID && response.OrderID !== expectedOrderId) {
    return { ...base, paid: false, error: "Order ID mismatch" };
  }
  if (status !== "AUTHORIZED" && status !== "CAPTURED") {
    return { ...base, paid: false, error: null };
  }
  if (amountCents !== expectedCents) {
    return { ...base, paid: false, error: `Amount mismatch: expected ${expectedCents}, got ${amountCents}` };
  }
  return { ...base, paid: true, error: null };
}

export async function verifyPayment(
  config: PsigateConfig,
  psigateOrderId: string,
  expectedCents: number,
  simulationLookup?: (id: string) => Promise<{ approved: boolean; totalCents: number } | null>,
): Promise<VerificationResult> {
  if (config.mode === "simulate") {
    const sim = simulationLookup ? await simulationLookup(psigateOrderId) : null;
    return evaluateVerification(
      sim
        ? {
            ResponseCode: "PSI-0000",
            OrderStatus: sim.approved ? "CAPTURED" : "DECLINED",
            OrderID: psigateOrderId,
            TransactionRefNumber: `SIM-${psigateOrderId}`,
            OrderPaymentCardInfo: { CardNumber: "411111...1111", CardType: "VISA", CardExpMonth: "12", CardExpYear: "30" },
            OrderAmountInfo: { FullTotal: centsToDecimal(sim.totalCents) },
          }
        : { ResponseCode: "PSI-0107", OrderStatus: "UNKNOWN" },
      psigateOrderId,
      expectedCents,
    );
  }

  try {
    const res = await fetch(config.verifyUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({ StoreID: config.storeId, PassPhrase: config.passphrase, OrderID: psigateOrderId }),
      signal: AbortSignal.timeout(20_000),
      cache: "no-store",
    });
    if (!res.ok) {
      return emptyVerification(`Verification HTTP ${res.status}`);
    }
    const data = (await res.json()) as VerifyResponse;
    return evaluateVerification(data, psigateOrderId, expectedCents);
  } catch (err) {
    return emptyVerification(err instanceof Error ? err.message : String(err));
  }
}

function emptyVerification(error: string): VerificationResult {
  return {
    paid: false,
    status: "UNKNOWN",
    amountCents: null,
    transRef: null,
    cardType: null,
    last4: null,
    expMonth: null,
    expYear: null,
    error,
  };
}

function xmlEscape(value: string) {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

/** Sale (CardAction 0) for the full order total, with either new card details or a PreOrderID. */
export function buildSaleXml(config: PsigateConfig, input: SaleInput) {
  const el = (name: string, value: string | null | undefined) => (value ? `<${name}>${xmlEscape(value)}</${name}>` : "");
  const b = input.billing;
  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    "<Order>",
    el("StoreID", config.storeId),
    el("Passphrase", config.passphrase),
    el("OrderID", input.psigateOrderId),
    // The full amount (items + shipping + tax) is charged as Subtotal; the itemized breakdown lives on our order.
    el("Subtotal", centsToDecimal(input.totalCents)),
    el("PaymentType", "CC"),
    el("CardAction", "0"),
    input.card
      ? [
          el("CardNumber", input.card.number),
          el("CardExpMonth", input.card.expMonth),
          el("CardExpYear", input.card.expYear),
          el("CardIDNumber", input.card.cvv),
        ].join("")
      : el("PreOrderID", input.preOrderId),
    el("Email", clean(input.email, 100)),
    el("Comments", clean(`Camille Allen order #${input.orderNumber}${input.preOrderId ? " (saved card)" : ""}`, 300)),
    b
      ? [
          el("Bname", clean(b.name)),
          el("Baddress1", clean(b.line1)),
          el("Baddress2", clean(b.line2)),
          el("Bcity", clean(b.city)),
          el("Bprovince", clean(b.region)),
          el("Bpostalcode", clean(b.postalCode, 16)),
          el("Bcountry", clean(b.country, 32)),
          el("Phone", clean(b.phone, 32)),
        ].join("")
      : "",
    input.customerIp && input.customerIp !== "unknown" ? el("CustomerIP", input.customerIp.slice(0, 15)) : "",
    "</Order>",
  ].join("");
}

export function parseXmlResult(xml: string) {
  const tag = (name: string) => xml.match(new RegExp(`<${name}>([\\s\\S]*?)</${name}>`))?.[1]?.trim() || null;
  return {
    orderId: tag("OrderID"),
    approved: tag("Approved")?.toUpperCase() ?? null,
    returnCode: tag("ReturnCode"),
    errMsg: tag("ErrMsg"),
    transRef: tag("TransRefNumber"),
    fullTotalCents: decimalToCents(tag("FullTotal")),
    cardNumber: tag("CardNumber"),
    cardType: tag("CardType"),
  };
}

/**
 * approved/declined are definitive answers from PSiGate. "unknown" means we never got a readable answer
 * (timeout, network or server error), so the card may or may not have been charged.
 */
export type ChargeResult =
  | { outcome: "approved"; transRef: string | null; cardType: string | null; last4: string | null; amountCents: number | null }
  | { outcome: "declined"; message: string }
  | { outcome: "unknown"; message: string };

export async function chargeCard(config: PsigateConfig, input: SaleInput): Promise<ChargeResult> {
  if (config.mode === "simulate") {
    if (input.card?.number === SIMULATED_DECLINE_CARD) return { outcome: "declined", message: "Simulated decline" };
    return {
      outcome: "approved",
      transRef: `SIM-${input.psigateOrderId}`,
      cardType: input.card ? "VISA" : null,
      last4: input.card ? input.card.number.slice(-4) : null,
      amountCents: input.totalCents,
    };
  }

  let res: Response;
  let body: string;
  try {
    res = await fetch(config.xmlUrl, {
      method: "POST",
      headers: { "Content-Type": "application/xml", Accept: "application/xml" },
      body: buildSaleXml(config, input),
      signal: AbortSignal.timeout(45_000),
      cache: "no-store",
    });
    body = await res.text();
  } catch (err) {
    return { outcome: "unknown", message: err instanceof Error ? err.message : String(err) };
  }

  const result = parseXmlResult(body);
  if (result.approved === "APPROVED") {
    return {
      outcome: "approved",
      transRef: result.transRef,
      cardType: result.cardType,
      last4: last4Of(result.cardNumber) ?? (input.card ? input.card.number.slice(-4) : null),
      amountCents: result.fullTotalCents,
    };
  }
  if (result.approved === "DECLINED" || result.approved === "ERROR") {
    return { outcome: "declined", message: result.errMsg ?? result.returnCode ?? result.approved };
  }
  return { outcome: "unknown", message: `Unexpected PSiGate response (HTTP ${res.status})` };
}
