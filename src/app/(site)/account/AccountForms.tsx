"use client";

import { useActionState } from "react";
import { AddressFields } from "@/components/forms/AddressFields";
import { FieldError, FormMessage } from "@/components/forms/FormMessage";
import { SubmitButton } from "@/components/forms/SubmitButton";
import { initialActionState } from "@/lib/forms";
import { addAddressAction, updateProfileAction } from "./actions";

export function ProfileForm({ name, phone, subscribed }: { name: string; phone: string; subscribed: boolean }) {
  const [state, action] = useActionState(updateProfileAction, initialActionState);
  return (
    <form action={action} className="form">
      <FormMessage state={state} />
      <div className="form-row">
        <div className="field">
          <label htmlFor="name">Name</label>
          <input id="name" name="name" autoComplete="name" defaultValue={state.values?.name ?? name} />
          <FieldError state={state} name="name" />
        </div>
        <div className="field">
          <label htmlFor="phone">Phone</label>
          <input id="phone" name="phone" type="tel" autoComplete="tel" defaultValue={state.values?.phone ?? phone} />
          <FieldError state={state} name="phone" />
        </div>
      </div>
      <label className="check">
        <input type="checkbox" name="newsletter" defaultChecked={subscribed} />
        Send me the newsletter about new sculptures and studio news
      </label>
      <div>
        <SubmitButton pendingLabel="Saving…">Save details</SubmitButton>
      </div>
    </form>
  );
}

export function AddAddressForm() {
  const [state, action] = useActionState(addAddressAction, initialActionState);
  return (
    <form action={action} className="form">
      <FormMessage state={state} />
      <AddressFields state={state.ok ? undefined : state} />
      <label className="check">
        <input type="checkbox" name="isDefault" />
        Make this my default address
      </label>
      <div>
        <SubmitButton pendingLabel="Saving…">Add address</SubmitButton>
      </div>
    </form>
  );
}
