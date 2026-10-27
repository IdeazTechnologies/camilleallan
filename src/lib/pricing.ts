/** Pure pricing helpers shared by the cart, checkout and tests. All amounts are integer cents. */

export type PricedLine = { unitPriceCents: number; quantity: number };

export type ShippingRuleLike = {
  id: string;
  name: string;
  description?: string | null;
  countries: string[];
  minSubtotalCents: number | null;
  maxSubtotalCents: number | null;
  minItems: number | null;
  maxItems: number | null;
  rateCents: number;
  perItemCents: number;
  active: boolean;
  sortOrder: number;
};

export type ShippingOption = { id: string; name: string; description: string | null; costCents: number };

export function subtotalOf(lines: PricedLine[]) {
  return lines.reduce((sum, l) => sum + l.unitPriceCents * l.quantity, 0);
}

export function itemCountOf(lines: PricedLine[]) {
  return lines.reduce((sum, l) => sum + l.quantity, 0);
}

export function ruleApplies(
  rule: ShippingRuleLike,
  ctx: { country: string; subtotalCents: number; itemCount: number },
) {
  if (!rule.active) return false;
  if (rule.countries.length > 0 && !rule.countries.includes(ctx.country.toUpperCase())) return false;
  if (rule.minSubtotalCents != null && ctx.subtotalCents < rule.minSubtotalCents) return false;
  if (rule.maxSubtotalCents != null && ctx.subtotalCents > rule.maxSubtotalCents) return false;
  if (rule.minItems != null && ctx.itemCount < rule.minItems) return false;
  if (rule.maxItems != null && ctx.itemCount > rule.maxItems) return false;
  return true;
}

export function shippingCost(rule: ShippingRuleLike, itemCount: number) {
  return Math.max(0, rule.rateCents + rule.perItemCents * itemCount);
}

/**
 * Eligible shipping options for a destination, cheapest first (ties keep admin sort order).
 * Like WooCommerce zones, rules with no countries ("everywhere else") only apply when no active
 * rule names the destination country.
 */
export function shippingOptionsFor(
  rules: ShippingRuleLike[],
  ctx: { country: string; subtotalCents: number; itemCount: number },
): ShippingOption[] {
  const country = ctx.country.toUpperCase();
  const countryHasZone = rules.some((r) => r.active && r.countries.includes(country));
  return rules
    .filter((r) => !(countryHasZone && r.countries.length === 0))
    .filter((r) => ruleApplies(r, ctx))
    .sort((a, b) => a.sortOrder - b.sortOrder)
    .map((r) => ({
      id: r.id,
      name: r.name,
      description: r.description ?? null,
      costCents: shippingCost(r, ctx.itemCount),
    }))
    .sort((a, b) => a.costCents - b.costCents);
}

export function computeTax(taxableCents: number, ratePercent: number) {
  if (!ratePercent || ratePercent <= 0) return 0;
  return Math.round((taxableCents * ratePercent) / 100);
}

export type Totals = {
  subtotalCents: number;
  shippingCents: number;
  taxCents: number;
  totalCents: number;
  itemCount: number;
};

export function computeTotals(
  lines: PricedLine[],
  shippingCents: number,
  tax: { ratePercent: number; includeShipping: boolean },
): Totals {
  const subtotalCents = subtotalOf(lines);
  const taxable = subtotalCents + (tax.includeShipping ? shippingCents : 0);
  const taxCents = computeTax(taxable, tax.ratePercent);
  return {
    subtotalCents,
    shippingCents,
    taxCents,
    totalCents: subtotalCents + shippingCents + taxCents,
    itemCount: itemCountOf(lines),
  };
}

/** PSiGate expects decimal dollar strings such as "125.00". */
export function centsToDecimal(cents: number) {
  return (cents / 100).toFixed(2);
}

export function decimalToCents(value: string | number | null | undefined) {
  if (value == null || value === "") return null;
  const n = typeof value === "number" ? value : Number(String(value).replace(/[^0-9.-]/g, ""));
  return Number.isFinite(n) ? Math.round(n * 100) : null;
}
