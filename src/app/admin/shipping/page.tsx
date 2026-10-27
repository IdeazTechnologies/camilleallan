import { asc } from "drizzle-orm";
import type { Metadata } from "next";
import { ConfirmButton } from "@/components/admin/ConfirmButton";
import { AdminHeader } from "@/components/admin/ui";
import { db } from "@/db";
import { shippingRules } from "@/db/schema";
import { requireAdmin } from "@/lib/dal";
import { formatMoney } from "@/lib/utils";
import { deleteShippingRuleAction } from "./actions";
import { ShippingRuleForm } from "./ShippingRuleForm";

export const metadata: Metadata = { title: "Shipping" };

export default async function AdminShipping() {
  await requireAdmin();
  const rules = await db.query.shippingRules.findMany({ orderBy: [asc(shippingRules.sortOrder), asc(shippingRules.name)] });
  return (
    <>
      <AdminHeader
        title="Shipping rules"
        description="At checkout, customers see every active rule that matches their country, order total and item count, cheapest first. Rules with no countries cover everywhere not listed in another rule."
      />
      <div className="stack">
        {rules.map((r) => (
          <details key={r.id} className="card" open={rules.length <= 3}>
            <summary className="spread" style={{ cursor: "pointer" }}>
              <strong>
                {r.name}{" "}
                <span className="muted" style={{ fontWeight: 300 }}>
                  · {r.countries.length ? r.countries.join(", ") : "Everywhere else"} ·{" "}
                  {r.rateCents === 0 && r.perItemCents === 0 ? "Free" : formatMoney(r.rateCents)}
                  {r.perItemCents ? ` + ${formatMoney(r.perItemCents)}/item` : ""}
                </span>
              </strong>
              {!r.active && <span className="badge">Inactive</span>}
            </summary>
            <div className="stack" style={{ marginTop: "var(--space-4)" }}>
              <ShippingRuleForm rule={r} />
              <form action={deleteShippingRuleAction}>
                <input type="hidden" name="id" value={r.id} />
                <ConfirmButton message={`Delete "${r.name}"?`} className="btn-ghost" style={{ color: "var(--color-danger)" }}>
                  Delete rule
                </ConfirmButton>
              </form>
            </div>
          </details>
        ))}
        <div className="card stack">
          <strong>New rule</strong>
          <ShippingRuleForm />
        </div>
      </div>
    </>
  );
}
