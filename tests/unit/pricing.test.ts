import { describe, expect, it } from "vitest";
import {
  computeTotals,
  decimalToCents,
  centsToDecimal,
  ruleApplies,
  shippingOptionsFor,
  type ShippingRuleLike,
} from "@/lib/pricing";

const rule = (overrides: Partial<ShippingRuleLike>): ShippingRuleLike => ({
  id: overrides.name ?? "rule",
  name: "rule",
  description: null,
  countries: [],
  minSubtotalCents: null,
  maxSubtotalCents: null,
  minItems: null,
  maxItems: null,
  rateCents: 0,
  perItemCents: 0,
  active: true,
  sortOrder: 0,
  ...overrides,
});

// The store's live configuration: free to Canada/USA, $15 everywhere else.
const storeRules = [
  rule({ name: "Free shipping", countries: ["CA", "US"], rateCents: 0, sortOrder: 0 }),
  rule({ name: "International flat rate", countries: [], rateCents: 1500, sortOrder: 1 }),
];

describe("shippingOptionsFor", () => {
  it("gives Canada and the USA only the free zone, not the catch-all", () => {
    for (const country of ["CA", "us"]) {
      const options = shippingOptionsFor(storeRules, { country, subtotalCents: 9900, itemCount: 1 });
      expect(options.map((o) => o.name)).toEqual(["Free shipping"]);
      expect(options[0].costCents).toBe(0);
    }
  });

  it("uses the catch-all rule for countries without a zone", () => {
    const options = shippingOptionsFor(storeRules, { country: "GB", subtotalCents: 9900, itemCount: 1 });
    expect(options).toEqual([{ id: "International flat rate", name: "International flat rate", description: null, costCents: 1500 }]);
  });

  it("falls back to the catch-all when the country's only rule is inactive", () => {
    const rules = [rule({ name: "Free", countries: ["CA"], active: false }), rule({ name: "Rest", rateCents: 2000 })];
    expect(shippingOptionsFor(rules, { country: "CA", subtotalCents: 100, itemCount: 1 }).map((o) => o.name)).toEqual(["Rest"]);
  });

  it("applies subtotal and item limits and sorts cheapest first", () => {
    const rules = [
      rule({ name: "Express", countries: ["US"], rateCents: 3000, sortOrder: 0 }),
      rule({ name: "Standard", countries: ["US"], rateCents: 1000, perItemCents: 250, sortOrder: 1 }),
      rule({ name: "Free over $200", countries: ["US"], minSubtotalCents: 20000, sortOrder: 2 }),
      rule({ name: "Small parcel", countries: ["US"], maxItems: 1, rateCents: 500, sortOrder: 3 }),
    ];
    const small = shippingOptionsFor(rules, { country: "US", subtotalCents: 9900, itemCount: 2 });
    expect(small.map((o) => [o.name, o.costCents])).toEqual([
      ["Standard", 1500],
      ["Express", 3000],
    ]);
    const big = shippingOptionsFor(rules, { country: "US", subtotalCents: 25000, itemCount: 1 });
    expect(big[0]).toMatchObject({ name: "Free over $200", costCents: 0 });
  });
});

describe("ruleApplies", () => {
  it("rejects inactive rules and other countries", () => {
    expect(ruleApplies(rule({ active: false }), { country: "CA", subtotalCents: 1, itemCount: 1 })).toBe(false);
    expect(ruleApplies(rule({ countries: ["CA"] }), { country: "US", subtotalCents: 1, itemCount: 1 })).toBe(false);
    expect(ruleApplies(rule({ countries: ["CA"] }), { country: "ca", subtotalCents: 1, itemCount: 1 })).toBe(true);
  });
});

describe("computeTotals", () => {
  const lines = [
    { unitPriceCents: 9900, quantity: 2 },
    { unitPriceCents: 27500, quantity: 1 },
  ];

  it("adds items, shipping and no tax by default", () => {
    expect(computeTotals(lines, 1500, { ratePercent: 0, includeShipping: true })).toEqual({
      subtotalCents: 47300,
      shippingCents: 1500,
      taxCents: 0,
      totalCents: 48800,
      itemCount: 3,
    });
  });

  it("taxes shipping only when configured and rounds to the cent", () => {
    expect(computeTotals(lines, 1500, { ratePercent: 5, includeShipping: true }).taxCents).toBe(2440);
    expect(computeTotals(lines, 1500, { ratePercent: 5, includeShipping: false }).taxCents).toBe(2365);
    expect(computeTotals([{ unitPriceCents: 999, quantity: 1 }], 0, { ratePercent: 12, includeShipping: false }).taxCents).toBe(120);
  });
});

describe("decimal conversion", () => {
  it("round-trips PSiGate decimal strings", () => {
    expect(centsToDecimal(12500)).toBe("125.00");
    expect(centsToDecimal(5)).toBe("0.05");
    expect(decimalToCents("125.00")).toBe(12500);
    expect(decimalToCents("$1,234.56")).toBe(123456);
    expect(decimalToCents(19.99)).toBe(1999);
    expect(decimalToCents("")).toBeNull();
    expect(decimalToCents(null)).toBeNull();
  });
});
