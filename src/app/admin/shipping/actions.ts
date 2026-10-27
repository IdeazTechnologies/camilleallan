"use server";

import { eq } from "drizzle-orm";
import { refresh } from "next/cache";
import { COUNTRY_NAMES } from "@/data/countries";
import { db } from "@/db";
import { shippingRules } from "@/db/schema";
import { audit } from "@/lib/audit";
import { requireAdmin } from "@/lib/dal";
import { checkbox, type ActionState } from "@/lib/forms";
import { parseMoneyToCents } from "@/lib/utils";

export async function saveShippingRuleAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const admin = await requireAdmin();
  const id = String(formData.get("id") ?? "") || null;
  const name = String(formData.get("name") ?? "").trim();
  if (!name) return { ok: false, message: "Name is required." };
  const countries = String(formData.get("countries") ?? "")
    .split(/[\s,]+/)
    .map((c) => c.trim().toUpperCase())
    .filter(Boolean);
  const unknown = countries.filter((c) => !(c in COUNTRY_NAMES));
  if (unknown.length) return { ok: false, message: `Unknown country code(s): ${unknown.join(", ")}. Use 2-letter codes like CA, US, GB.` };
  const intOrNull = (k: string) => {
    const n = Number.parseInt(String(formData.get(k) ?? ""), 10);
    return Number.isFinite(n) ? n : null;
  };
  const row = {
    name,
    description: String(formData.get("description") ?? "").trim() || null,
    countries,
    rateCents: parseMoneyToCents(formData.get("rate")) ?? 0,
    perItemCents: parseMoneyToCents(formData.get("perItem")) ?? 0,
    minSubtotalCents: parseMoneyToCents(formData.get("minSubtotal")),
    maxSubtotalCents: parseMoneyToCents(formData.get("maxSubtotal")),
    minItems: intOrNull("minItems"),
    maxItems: intOrNull("maxItems"),
    active: checkbox(formData, "active"),
    sortOrder: intOrNull("sortOrder") ?? 0,
  };
  if (id) await db.update(shippingRules).set(row).where(eq(shippingRules.id, id));
  else await db.insert(shippingRules).values(row);
  await audit(admin.id, id ? "shipping.update" : "shipping.create", "shipping_rule", id, row);
  refresh();
  return { ok: true, message: "Saved." };
}

export async function deleteShippingRuleAction(formData: FormData) {
  const admin = await requireAdmin();
  const id = String(formData.get("id"));
  await db.delete(shippingRules).where(eq(shippingRules.id, id));
  await audit(admin.id, "shipping.delete", "shipping_rule", id);
  refresh();
}
