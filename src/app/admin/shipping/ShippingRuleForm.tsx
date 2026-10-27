"use client";

import { useActionState } from "react";
import { FormMessage } from "@/components/forms/FormMessage";
import { SubmitButton } from "@/components/forms/SubmitButton";
import { initialActionState } from "@/lib/forms";
import { centsToInput } from "@/lib/utils";
import { saveShippingRuleAction } from "./actions";

type Rule = {
  id: string;
  name: string;
  description: string | null;
  countries: string[];
  rateCents: number;
  perItemCents: number;
  minSubtotalCents: number | null;
  maxSubtotalCents: number | null;
  minItems: number | null;
  maxItems: number | null;
  active: boolean;
  sortOrder: number;
};

export function ShippingRuleForm({ rule }: { rule?: Rule }) {
  const [state, action] = useActionState(saveShippingRuleAction, initialActionState);
  return (
    <form action={action} className="form">
      {rule && <input type="hidden" name="id" value={rule.id} />}
      <div className="form-row">
        <div className="field">
          <label>Name shown at checkout</label>
          <input name="name" required defaultValue={rule?.name} placeholder="e.g. Free shipping" />
        </div>
        <div className="field">
          <label>Description</label>
          <input name="description" defaultValue={rule?.description ?? ""} placeholder="e.g. 5 to 10 business days" />
        </div>
      </div>
      <div className="field">
        <label>Countries</label>
        <input name="countries" defaultValue={rule?.countries.join(", ")} placeholder="CA, US (leave blank for all other countries)" />
        <span className="hint">
          2-letter country codes separated by commas. Blank means &quot;everywhere else&quot;: countries not listed in any other active rule.
        </span>
      </div>
      <div className="form-row">
        <div className="field">
          <label>Flat rate ($)</label>
          <input name="rate" inputMode="decimal" defaultValue={centsToInput(rule?.rateCents ?? 0)} />
        </div>
        <div className="field">
          <label>Plus per item ($)</label>
          <input name="perItem" inputMode="decimal" defaultValue={centsToInput(rule?.perItemCents ?? 0)} />
        </div>
        <div className="field">
          <label>Min order ($)</label>
          <input name="minSubtotal" inputMode="decimal" defaultValue={centsToInput(rule?.minSubtotalCents)} />
        </div>
        <div className="field">
          <label>Max order ($)</label>
          <input name="maxSubtotal" inputMode="decimal" defaultValue={centsToInput(rule?.maxSubtotalCents)} />
        </div>
        <div className="field">
          <label>Min items</label>
          <input name="minItems" type="number" min={0} defaultValue={rule?.minItems ?? ""} />
        </div>
        <div className="field">
          <label>Max items</label>
          <input name="maxItems" type="number" min={0} defaultValue={rule?.maxItems ?? ""} />
        </div>
        <div className="field">
          <label>Sort order</label>
          <input name="sortOrder" type="number" defaultValue={rule?.sortOrder ?? 0} />
        </div>
      </div>
      <div className="cluster">
        <label className="check">
          <input type="checkbox" name="active" defaultChecked={rule?.active ?? true} />
          Active
        </label>
        <SubmitButton className="btn-sm" pendingLabel="Saving…">
          {rule ? "Save rule" : "Add rule"}
        </SubmitButton>
        <FormMessage state={state} />
      </div>
    </form>
  );
}
