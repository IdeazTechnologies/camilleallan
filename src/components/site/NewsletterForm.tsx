"use client";

import { useActionState } from "react";
import { subscribeAction } from "@/app/(site)/newsletter/actions";
import { BotFields } from "@/components/forms/BotFields";
import { SubmitButton } from "@/components/forms/SubmitButton";
import { initialActionState } from "@/lib/forms";

export function NewsletterForm({ source = "footer" }: { source?: string }) {
  const [state, action] = useActionState(subscribeAction, initialActionState);
  return (
    <form action={action} className="stack stack-sm" style={{ position: "relative" }}>
      <input type="hidden" name="source" value={source} />
      <BotFields />
      <div className="cluster" style={{ flexWrap: "nowrap" }}>
        <label className="sr-only" htmlFor={`nl-${source}`}>
          Email address
        </label>
        <input
          id={`nl-${source}`}
          className="input"
          type="email"
          name="email"
          required
          placeholder="Your email address"
          autoComplete="email"
        />
        <SubmitButton pendingLabel="…">Subscribe</SubmitButton>
      </div>
      {state.message && (
        <p role="status" style={{ fontSize: "var(--step--1)", color: state.ok ? "var(--color-success)" : "var(--color-danger)" }}>
          {state.message}
        </p>
      )}
    </form>
  );
}
