"use client";

import { useActionState, useState } from "react";
import { FormMessage } from "@/components/forms/FormMessage";
import { SubmitButton } from "@/components/forms/SubmitButton";
import { initialActionState } from "@/lib/forms";
import { ORDER_STATUS_LABELS } from "@/lib/utils";
import { changeStatusAction, recheckPaymentAction, resendConfirmationAction } from "./actions";

export function StatusForm({ orderId, current, allowed }: { orderId: string; current: string; allowed: string[] }) {
  const [state, action] = useActionState(changeStatusAction, initialActionState);
  const [to, setTo] = useState(allowed.includes("shipped") ? "shipped" : (allowed[0] ?? ""));
  if (allowed.length === 0) return <p className="muted">No further status changes are available for a {current} order.</p>;
  const notifies = to === "shipped" || to === "cancelled" || to === "refunded";

  return (
    <form action={action} className="stack">
      <input type="hidden" name="orderId" value={orderId} />
      <div className="field">
        <label htmlFor="to">Change status to</label>
        <select id="to" name="to" value={to} onChange={(e) => setTo(e.target.value)}>
          {allowed.map((s) => (
            <option key={s} value={s}>
              {ORDER_STATUS_LABELS[s] ?? s}
            </option>
          ))}
        </select>
      </div>
      {to === "shipped" && (
        <div className="stack stack-sm">
          <div className="form-row">
            <input className="input" name="carrier" placeholder="Carrier (e.g. Canada Post)" />
            <input className="input" name="trackingNumber" placeholder="Tracking number" />
          </div>
          <input className="input" name="trackingUrl" type="url" placeholder="Tracking link (optional)" />
        </div>
      )}
      {(to === "cancelled" || to === "refunded") && current !== "pending" && (
        <label className="check">
          <input type="checkbox" name="restock" defaultChecked />
          Return items to stock
        </label>
      )}
      {(to === "cancelled" || to === "refunded") && (
        <p className="alert warning" style={{ fontSize: "var(--step--1)" }}>
          Refunds must be issued in the PSiGate merchant portal. This only updates the order here.
        </p>
      )}
      {notifies && (
        <label className="check">
          <input type="checkbox" name="notify" defaultChecked />
          Email the customer
        </label>
      )}
      <FormMessage state={state} />
      <div>
        <SubmitButton pendingLabel="Updating…">Update order</SubmitButton>
      </div>
    </form>
  );
}

export function RecheckPaymentButton({ orderId }: { orderId: string }) {
  const [state, action] = useActionState(recheckPaymentAction, initialActionState);
  return (
    <form action={action} className="stack stack-sm">
      <input type="hidden" name="orderId" value={orderId} />
      <SubmitButton className="btn-outline btn-sm" pendingLabel="Checking PSiGate…">
        Re-check payment with PSiGate
      </SubmitButton>
      <FormMessage state={state} />
    </form>
  );
}

export function ResendConfirmationButton({ orderId }: { orderId: string }) {
  const [state, action] = useActionState(resendConfirmationAction, initialActionState);
  return (
    <form action={action} className="stack stack-sm">
      <input type="hidden" name="orderId" value={orderId} />
      <SubmitButton className="btn-ghost btn-sm" pendingLabel="Sending…">
        Re-send confirmation email
      </SubmitButton>
      <FormMessage state={state} />
    </form>
  );
}
