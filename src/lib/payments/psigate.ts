import { centsToDecimal, decimalToCents } from "@/lib/pricing";

/**
 * PSiGate integration:
 *  - New cards: browser POSTs to PSiGate's hosted page (Real-time HTML API). Card data never reaches us.
 *  - Confirmation: the browser return is untrusted, so every result is confirmed server-to-server with the
 *    Order Verification API before an order is marked paid.
 *  - Saved cards: recharge a previous PSiGate order with PreOrderID through the Real-time XML API.
 */

export type PsigateMode = "test" | "live" | "simulate";

export type PsigateConfig = {
  mode: PsigateMode;
  storeKey: string;
  storeId: string;
  passphrase: string;
  htmlUrl: string;
  xmlUrl: string;
  verifyUrl: string;
  savedCardsEnabled: boolean;
};

const ENDPOINTS = {
  test: {
    html: "https://stagingcheckout.psigate.com/HTMLPost/HTMLMessenger",
    xml: "https://realtimestaging.psigate.com/xml",
    verify: "https://realtimestaging.psigate.com/verify/json",
  },
  live: {
    html: "https://checkout.psigate.com/HTMLPost/HTMLMessenger",
    xml: "https://realtime.psigate.com/xml",
    verify: "https://realtime.psigate.com/verify/json",
  },
};

export function getPsigateConfig(env: Record<string, string | undefined> = process.env): PsigateConfig | null {
  const requested = (env.PSIGATE_MODE ?? "").toLowerCase();
  if (requested === "simulate") {
    if (env.VERCEL_ENV === "production") return null;
    return {
      mode: "simulate",
      storeKey: "simulator",
      storeId: "simulator",
      passphrase: "",
      htmlUrl: "/checkout/simulator",
      xmlUrl: "",
      verifyUrl: "",
      savedCardsEnabled: env.PSIGATE_SAVED_CARDS === "true",
    };
  }
  const mode: PsigateMode = requested === "live" ? "live" : "test";
  const storeKey = env.PSIGATE_STORE_KEY ?? "";
  const storeId = env.PSIGATE_STORE_ID ?? "";
  const passphrase = env.PSIGATE_PASSPHRASE ?? "";
  if (!storeKey || !storeId || !passphrase) return null;
  const e = ENDPOINTS[mode];
  return {
    mode,
    storeKey,
    storeId,
    passphrase,
    htmlUrl: env.PSIGATE_HTML_URL || e.html,
    xmlUrl: env.PSIGATE_XML_URL || e.xml,
    verifyUrl: env.PSIGATE_VERIFY_URL || e.verify,
    savedCardsEnabled: env.PSIGATE_SAVED_CARDS === "true",
  };
}

/** PSiGate OrderIDs must be unique per store, so each payment attempt gets a fresh one. */
export function newPsigateOrderId(orderNumber: number) {
  const suffix = crypto.randomUUID().replaceAll("-", "").slice(0, 10).toUpperCase();
  return `CA${orderNumber}-${suffix}`;
}

export type HostedPaymentInput = {
  psigateOrderId: string;
  totalCents: number;
  orderNumber: number;
  email: string;
  customerIp?: string;
  billing: {
    name: string;
    line1: string;
    line2?: string | null;
    city: string;
    region: string;
    postalCode: string;
    country: string;
    phone?: string | null;
  };
  thanksUrl: string;
  noThanksUrl: string;
};

/** Strips characters PSiGate rejects (e.g. "&") and trims to a field length. */
function clean(value: string | null | undefined, max = 64) {
  return (value ?? "").replace(/[&<>"]/g, " ").replace(/\s+/g, " ").trim().slice(0, max);
}

export function buildHostedPaymentForm(config: PsigateConfig, input: HostedPaymentInput) {
  const b = input.billing;
  const fields: Record<string, string> = {
    StoreKey: config.storeKey,
    PaymentType: "CC",
    CardAction: "0",
    OrderID: input.psigateOrderId,
    // The full amount (items + shipping + tax) is charged as SubTotal; the itemized breakdown lives on our order.
    SubTotal: centsToDecimal(input.totalCents),
    Comments: clean(`Camille Allen order #${input.orderNumber}`, 300),
    CustomerRefNo: clean(String(input.orderNumber), 25),
    Email: clean(input.email, 100),
    Bname: clean(b.name),
    Baddress1: clean(b.line1),
    Baddress2: clean(b.line2),
    Bcity: clean(b.city),
    Bprovince: clean(b.region),
    Bpostalcode: clean(b.postalCode, 16),
    Bcountry: clean(b.country, 32),
    Phone: clean(b.phone, 32),
    CustomerLanguage: "EN",
    ThanksURL: input.thanksUrl,
    NoThanksURL: input.noThanksUrl,
  };
  if (input.customerIp && input.customerIp !== "unknown") fields.CustomerIP = input.customerIp.slice(0, 15);
  for (const key of Object.keys(fields)) if (fields[key] === "") delete fields[key];
  return { action: config.htmlUrl, fields };
}

/** Fields PSiGate posts (or appends) to ThanksURL/NoThanksURL. Treated as hints only. */
export type HostedReturn = {
  orderId: string | null;
  approved: "APPROVED" | "DECLINED" | "ERROR" | null;
  returnCode: string | null;
  errMsg: string | null;
  transRef: string | null;
  fullTotalCents: number | null;
  cardNumber: string | null;
  cardType: string | null;
};

export function parseHostedReturn(params: URLSearchParams | FormData): HostedReturn {
  const get = (k: string) => {
    const v = params.get(k);
    return typeof v === "string" && v !== "" ? v : null;
  };
  const approvedRaw = get("Approved")?.toUpperCase() ?? null;
  return {
    orderId: get("OrderID"),
    approved:
      approvedRaw === "APPROVED" || approvedRaw === "DECLINED" || approvedRaw === "ERROR" ? approvedRaw : null,
    returnCode: get("ReturnCode"),
    errMsg: get("ErrMsg"),
    transRef: get("TransRefNumber"),
    fullTotalCents: decimalToCents(get("FullTotal")),
    cardNumber: get("CardNumber"),
    cardType: get("CardType"),
  };
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

export function buildSavedCardSaleXml(
  config: PsigateConfig,
  input: { psigateOrderId: string; preOrderId: string; totalCents: number; email: string; orderNumber: number },
) {
  const el = (name: string, value: string) => `<${name}>${xmlEscape(value)}</${name}>`;
  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    "<Order>",
    el("StoreID", config.storeId),
    el("Passphrase", config.passphrase),
    el("OrderID", input.psigateOrderId),
    el("PreOrderID", input.preOrderId),
    el("SubTotal", centsToDecimal(input.totalCents)),
    el("PaymentType", "CC"),
    el("CardAction", "0"),
    el("Email", clean(input.email, 100)),
    el("Comments", `Camille Allen order #${input.orderNumber} (saved card)`),
    "</Order>",
  ].join("");
}

export function parseXmlResult(xml: string) {
  const tag = (name: string) => xml.match(new RegExp(`<${name}>([\\s\\S]*?)</${name}>`))?.[1]?.trim() ?? null;
  return {
    orderId: tag("OrderID"),
    approved: tag("Approved"),
    returnCode: tag("ReturnCode"),
    errMsg: tag("ErrMsg"),
    transRef: tag("TransRefNumber"),
    fullTotalCents: decimalToCents(tag("FullTotal")),
  };
}

/** Charges a saved card (PreOrderID). The caller must still confirm with verifyPayment. */
export async function chargeSavedCard(
  config: PsigateConfig,
  input: { psigateOrderId: string; preOrderId: string; totalCents: number; email: string; orderNumber: number },
) {
  if (config.mode === "simulate") {
    return { approved: true, error: null as string | null };
  }
  try {
    const res = await fetch(config.xmlUrl, {
      method: "POST",
      headers: { "Content-Type": "application/xml" },
      body: buildSavedCardSaleXml(config, input),
      signal: AbortSignal.timeout(30_000),
      cache: "no-store",
    });
    const result = parseXmlResult(await res.text());
    if (result.approved === "APPROVED") return { approved: true, error: null };
    return { approved: false, error: result.errMsg ?? result.returnCode ?? `HTTP ${res.status}` };
  } catch (err) {
    return { approved: false, error: err instanceof Error ? err.message : String(err) };
  }
}
