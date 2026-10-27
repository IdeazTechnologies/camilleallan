import { describe, expect, it } from "vitest";
import {
  buildHostedPaymentForm,
  buildSavedCardSaleXml,
  evaluateVerification,
  getPsigateConfig,
  last4Of,
  newPsigateOrderId,
  parseHostedReturn,
  parseXmlResult,
  verifyPayment,
} from "@/lib/payments/psigate";

const liveEnv = {
  PSIGATE_MODE: "live",
  PSIGATE_STORE_KEY: "key123",
  PSIGATE_STORE_ID: "camilleallenartistus",
  PSIGATE_PASSPHRASE: "secret",
};

describe("getPsigateConfig", () => {
  it("returns null until credentials are configured", () => {
    expect(getPsigateConfig({})).toBeNull();
    expect(getPsigateConfig({ PSIGATE_MODE: "live", PSIGATE_STORE_ID: "x" })).toBeNull();
  });

  it("uses the production endpoints in live mode", () => {
    const config = getPsigateConfig(liveEnv)!;
    expect(config.mode).toBe("live");
    expect(config.xmlUrl).toBe("https://realtime.psigate.com/xml");
    expect(config.htmlUrl).toBe("https://checkout.psigate.com/HTMLPost/HTMLMessenger");
  });

  it("defaults to the staging endpoints", () => {
    const config = getPsigateConfig({ ...liveEnv, PSIGATE_MODE: "" })!;
    expect(config.mode).toBe("test");
    expect(config.xmlUrl).toContain("staging");
  });

  it("never allows the simulator on Vercel production", () => {
    expect(getPsigateConfig({ PSIGATE_MODE: "simulate" })?.mode).toBe("simulate");
    expect(getPsigateConfig({ PSIGATE_MODE: "simulate", VERCEL_ENV: "production" })).toBeNull();
  });
});

describe("buildHostedPaymentForm", () => {
  const config = getPsigateConfig(liveEnv)!;
  const form = buildHostedPaymentForm(config, {
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
    thanksUrl: "https://camilleallen.com/api/psigate/return?r=ok",
    noThanksUrl: "https://camilleallen.com/api/psigate/return?r=no",
  });

  it("posts the full total and order reference to PSiGate", () => {
    expect(form.action).toBe(config.htmlUrl);
    expect(form.fields).toMatchObject({
      StoreKey: "key123",
      OrderID: "CA1582-ABC",
      SubTotal: "114.00",
      CardAction: "0",
      CustomerRefNo: "1582",
      CustomerIP: "203.0.113.9",
    });
  });

  it("strips characters PSiGate rejects and omits empty fields", () => {
    expect(form.fields.Bname).toBe("Jane Doe Co");
    expect(form.fields).not.toHaveProperty("Baddress2");
    expect(form.fields).not.toHaveProperty("Phone");
  });
});

describe("parseHostedReturn", () => {
  it("reads PSiGate's return fields", () => {
    const r = parseHostedReturn(
      new URLSearchParams({ OrderID: "CA1-X", Approved: "approved", FullTotal: "99.00", TransRefNumber: "T1", CardNumber: "4111...1111" }),
    );
    expect(r).toMatchObject({ orderId: "CA1-X", approved: "APPROVED", fullTotalCents: 9900, transRef: "T1" });
  });

  it("ignores unexpected Approved values", () => {
    expect(parseHostedReturn(new URLSearchParams({ Approved: "yes please" })).approved).toBeNull();
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

describe("saved-card XML", () => {
  const config = getPsigateConfig(liveEnv)!;
  it("escapes values and references the original order", () => {
    const xml = buildSavedCardSaleXml(config, { psigateOrderId: "CA9-Z", preOrderId: "CA1-X", totalCents: 1234, email: "a&b@example.com", orderNumber: 9 });
    expect(xml).toContain("<StoreID>camilleallenartistus</StoreID>");
    expect(xml).toContain("<PreOrderID>CA1-X</PreOrderID>");
    expect(xml).toContain("<SubTotal>12.34</SubTotal>");
    expect(xml).not.toMatch(/a&b/);
  });

  it("parses the XML response", () => {
    const r = parseXmlResult("<Result><OrderID>CA9-Z</OrderID><Approved>APPROVED</Approved><FullTotal>12.34</FullTotal></Result>");
    expect(r).toMatchObject({ orderId: "CA9-Z", approved: "APPROVED", fullTotalCents: 1234 });
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
