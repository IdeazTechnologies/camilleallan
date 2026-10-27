"use client";

import { useActionState } from "react";
import { BotFields } from "@/components/forms/BotFields";
import { FieldError, FormMessage } from "@/components/forms/FormMessage";
import { SubmitButton } from "@/components/forms/SubmitButton";
import { initialActionState } from "@/lib/forms";
import { contactAction } from "./actions";

export function ContactForm({ defaultKind, defaultSubject }: { defaultKind: "general" | "custom_order"; defaultSubject?: string }) {
  const [state, action] = useActionState(contactAction, initialActionState);
  if (state.ok) return <FormMessage state={state} />;
  const v = (k: string, fallback = "") => state.values?.[k] ?? fallback;

  return (
    <form action={action} className="form" noValidate>
      <FormMessage state={state} />
      <BotFields />
      <fieldset className="cluster" style={{ border: 0, padding: 0 }}>
        <legend className="sr-only">Type of enquiry</legend>
        <label className="radio-card">
          <input type="radio" name="kind" value="general" defaultChecked={v("kind", defaultKind) === "general"} />
          General question
        </label>
        <label className="radio-card">
          <input type="radio" name="kind" value="custom_order" defaultChecked={v("kind", defaultKind) === "custom_order"} />
          Custom order
        </label>
      </fieldset>
      <div className="form-row">
        <div className="field">
          <label htmlFor="name">Name</label>
          <input id="name" name="name" autoComplete="name" required defaultValue={v("name")} />
          <FieldError state={state} name="name" />
        </div>
        <div className="field">
          <label htmlFor="email">Email</label>
          <input id="email" name="email" type="email" autoComplete="email" required defaultValue={v("email")} />
          <FieldError state={state} name="email" />
        </div>
      </div>
      <div className="form-row">
        <div className="field">
          <label htmlFor="phone">Phone (optional)</label>
          <input id="phone" name="phone" type="tel" autoComplete="tel" defaultValue={v("phone")} />
        </div>
        <div className="field">
          <label htmlFor="subject">Subject</label>
          <input id="subject" name="subject" defaultValue={v("subject", defaultSubject)} />
        </div>
      </div>
      <div className="field">
        <label htmlFor="message">Message</label>
        <textarea id="message" name="message" required defaultValue={v("message")} />
        <span className="hint">For custom orders, tell us about size, skin tone, hair, eye color and any timeline.</span>
        <FieldError state={state} name="message" />
      </div>
      <div>
        <SubmitButton pendingLabel="Sending…">Send message</SubmitButton>
      </div>
    </form>
  );
}
