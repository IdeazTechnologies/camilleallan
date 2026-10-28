import { afterEach, describe, expect, it, vi } from "vitest";
import {
  buildSaleXml,
  chargeCard,
  evaluateVerification,
  getPsigateConfig,
  last4Of,
  newPsigateOrderId,
  parseCardInput,
  parseXmlResult,
  SIMULATED_DECLINE_CARD,
  verifyPayment,
} from "@/lib/payments/psigate";

const liveEnv = {
  PSIGATE_MODE: "live",
  PSIGATE_STORE_ID: "camilleallenartistus",
  PSIGATE_PASSPHRASE: "secret",
};

const card = { number: "4111111111111111", expMonth: "02", expYear: "30", cvv: "123" };

const sale = {
  psigateOrderId: "CA1582-ABC",
  totalCents: 11400,
  orderNumber: 1582,
  email: "buyer@example.com",
  customerIp: "203.0.113.9",
  billing: {
    name: "Jane <Doe> & Co",
    line1: "1 Main St",
    line2: "",
    city: "Vancouver",
    region: "BC",
    postalCode: "V6B 1A1",
    country: "CA",
  },
};

describe("getPsigateConfig", () => {
  it("returns null until the StoreID and Passphrase are configured", () => {
    expect(getPsigateConfig({})).toBeNull();
    expect(getPsigateConfig({ PSIGATE_MODE: "live", PSIGATE_STORE_ID: "x" })).toBeNull();
  });

  it("uses the production endpoints in live mode", () => {
    const config = getPsigateConfig(liveEnv)!;
    expect(config.mode).toBe("live");
    expect(config.xmlUrl).toBe("https://realtime.psigate.com/xml");
  });

  it("defaults to the staging endpoints", () => {
    const config = getPsigateConfig({ ...liveEnv, PSIGATE_MODE: "" })!;
    expect(config.mode).toBe("test");
    expect(config.xmlUrl).toContain("staging");
  });

  it("never allows simulated payments on Vercel production", () => {
    expect(getPsigateConfig({ PSIGATE_MODE: "simulate" })?.mode).toBe("simulate");
    expect(getPsigateConfig({ PSIGATE_MODE: "simulate", VERCEL_ENV: "production" })).toBeNull();
  });
});

describe("parseCardInput", () => {
  const now = new Date(2026, 9, 27);

  it("normalizes a valid card", () => {
    const r = parseCardInput({ number: "4111 1111-1111 1111", expiry: "2/30", cvv: " 123 " }, now);
    expect(r).toEqual({ ok: true, card: { number: "4111111111111111", expMonth: "02", expYear: "30", cvv: "123" } });
    expect(parseCardInput({ number: "4111111111111111", expiry: "10/2026", cvv: "1234" }, now).ok).toBe(true);
  });

  it("rejects bad numbers, past or malformed expiry and bad CVV", () => {
    const r = parseCardInput({ number: "4111111111111112", expiry: "09/26", cvv: "12" }, now);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(Object.keys(r.errors).sort()).toEqual(["cardCvv", "cardExpiry", "cardNumber"]);
    const bad = parseCardInput({ number: "4111111111111111", expiry: "13/30", cvv: "123" }, now);
    expect(!bad.ok && bad.errors.cardExpiry).toMatch(/MM\/YY/);
  });

  it("accepts only Visa and Mastercard", () => {
    const valid = { expiry: "12/30", cvv: "123" };
    expect(parseCardInput({ ...valid, number: "5555555555554444" }, now).ok).toBe(true);
    expect(parseCardInput({ ...valid, number: "2223003122003222" }, now).ok).toBe(true);
    const amex = parseCardInput({ ...valid, number: "378282246310005", cvv: "1234" }, now);
    expect(!amex.ok && amex.errors.cardNumber).toMatch(/Visa and Mastercard/);
  });
});

describe("buildSaleXml", () => {
  const config = getPsigateConfig(liveEnv)!;

  it("sends a Sale for the full total with the card and billing details", () => {
    const xml = buildSaleXml(config, { ...sale, card });
    expect(xml).toContain("<StoreID>camilleallenartistus</StoreID><Passphrase>secret</Passphrase>");
    expect(xml).toContain("<OrderID>CA1582-ABC</OrderID><Subtotal>114.00</Subtotal><PaymentType>CC</PaymentType><CardAction>0</CardAction>");
    expect(xml).toContain("<CardNumber>4111111111111111</CardNumber><CardExpMonth>02</CardExpMonth><CardExpYear>30</CardExpYear><CardIDNumber>123</CardIDNumber>");
    expect(xml).toContain("<CustomerIP>203.0.113.9</CustomerIP>");
    expect(xml).not.toContain("PreOrderID");
  });

  it("strips characters PSiGate rejects and omits empty fields", () => {
    const xml = buildSaleXml(config, { ...sale, card });
    expect(xml).toContain("<Bname>Jane Doe Co</Bname>");
    expect(xml).not.toContain("<Baddress2>");
    expect(xml).not.toContain("<Phone>");
  });

  it("recharges a saved card by PreOrderID without card details", () => {
    const xml = buildSaleXml(config, { ...sale, email: "a&b@example.com", preOrderId: "CA1-X" });
    expect(xml).toContain("<PreOrderID>CA1-X</PreOrderID>");
    expect(xml).not.toContain("CardNumber");
    expect(xml).not.toMatch(/a&b/);
  });
});

describe("chargeCard", () => {
  const config = getPsigateConfig(liveEnv)!;
  const respond = (body: string) => vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(body, { status: 200 }));
  afterEach(() => vi.restoreAllMocks());

  it("returns approval details from PSiGate", async () => {
    respond(
      "<Result><OrderID>CA1582-ABC</OrderID><Approved>APPROVED</Approved><ReturnCode>Y:123:456:M:X:YYY</ReturnCode><FullTotal>114.00</FullTotal><TransRefNumber>1bd5a2</TransRefNumber><CardNumber>411111...1111</CardNumber><CardType>VISA</CardType></Result>",
    );
    expect(await chargeCard(config, { ...sale, card })).toEqual({
      outcome: "approved",
      transRef: "1bd5a2",
      cardType: "VISA",
      last4: "1111",
      amountCents: 11400,
    });
  });

  it("treats DECLINED and ERROR as definitive declines", async () => {
    respond("<Result><Approved>DECLINED</Approved><ReturnCode>N:DECLINED</ReturnCode><ErrMsg></ErrMsg></Result>");
    expect(await chargeCard(config, { ...sale, card })).toEqual({ outcome: "declined", message: "N:DECLINED" });
    respond("<Result><Approved>ERROR</Approved><ReturnCode>N:ERROR</ReturnCode><ErrMsg>PSI-1004:Invalid card.</ErrMsg></Result>");
    expect(await chargeCard(config, { ...sale, card })).toEqual({ outcome: "declined", message: "PSI-1004:Invalid card." });
  });

  it("reports an unknown outcome when PSiGate can't be reached or answers oddly", async () => {
    vi.spyOn(globalThis, "fetch").mockRejectedValue(new Error("timeout"));
    expect(await chargeCard(config, { ...sale, card })).toEqual({ outcome: "unknown", message: "timeout" });
    respond("<html>Bad gateway</html>");
    expect((await chargeCard(config, { ...sale, card })).outcome).toBe("unknown");
  });

  it("simulates approvals and declines without calling PSiGate", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch");
    const sim = getPsigateConfig({ PSIGATE_MODE: "simulate" })!;
    expect((await chargeCard(sim, { ...sale, card })).outcome).toBe("approved");
    expect((await chargeCard(sim, { ...sale, card: { ...card, number: SIMULATED_DECLINE_CARD } })).outcome).toBe("declined");
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});

describe("parseXmlResult", () => {
  it("parses the XML response", () => {
    const r = parseXmlResult("<Result><OrderID>CA9-Z</OrderID><Approved>APPROVED</Approved><FullTotal>12.34</FullTotal></Result>");
    expect(r).toMatchObject({ orderId: "CA9-Z", approved: "APPROVED", fullTotalCents: 1234 });
  });
});

describe("evaluateVerification", () => {
  const ok = {
    ResponseCode: "PSI-0000",
    OrderStatus: "CAPTURED",
    OrderID: "CA1-X",
    TransactionRefNumber: "REF",
    OrderPaymentCardInfo: { CardNumber: "411111******1111", CardType: "VISA", CardExpMonth: "12", CardExpYear: "30" },
    OrderAmountInfo: { FullTotal: "99.00" },
  };

  it("marks a captured order with the right amount as paid", () => {
    expect(evaluateVerification(ok, "CA1-X", 9900)).toMatchObject({ paid: true, last4: "1111", cardType: "VISA", error: null });
  });

  it("rejects amount and order mismatches", () => {
    expect(evaluateVerification(ok, "CA1-X", 10000)).toMatchObject({ paid: false });
    expect(evaluateVerification(ok, "CA1-X", 10000).error).toMatch(/Amount mismatch/);
    expect(evaluateVerification(ok, "CA2-Y", 9900)).toMatchObject({ paid: false, error: "Order ID mismatch" });
  });

  it("treats declined orders and error responses as unpaid", () => {
    expect(evaluateVerification({ ...ok, OrderStatus: "DECLINED" }, "CA1-X", 9900)).toMatchObject({ paid: false, error: null });
    expect(evaluateVerification({ ResponseCode: "PSI-2101" }, "CA1-X", 9900).error).toMatch(/PSI-2101/);
  });
});

describe("simulated verification", () => {
  const sim = getPsigateConfig({ PSIGATE_MODE: "simulate" })!;
  it("uses the recorded simulation result", async () => {
    const approved = await verifyPayment(sim, "CA1-X", 9900, async () => ({ approved: true, totalCents: 9900 }));
    expect(approved.paid).toBe(true);
    const missing = await verifyPayment(sim, "CA1-X", 9900, async () => null);
    expect(missing.paid).toBe(false);
  });
});

describe("helpers", () => {
  it("creates unique order ids that include the order number", () => {
    const a = newPsigateOrderId(1582);
    expect(a).toMatch(/^CA1582-[0-9A-F]{10}$/);
    expect(newPsigateOrderId(1582)).not.toBe(a);
  });

  it("extracts the last four digits", () => {
    expect(last4Of("4111 **** **** 1234")).toBe("1234");
    expect(last4Of("12")).toBeNull();
    expect(last4Of(null)).toBeNull();
  });
});
