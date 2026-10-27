"use client";

import { useActionState, useState } from "react";
import { BotFields } from "@/components/forms/BotFields";
import { FieldError, FormMessage } from "@/components/forms/FormMessage";
import { SubmitButton } from "@/components/forms/SubmitButton";
import { initialActionState } from "@/lib/forms";
import { requestLoginCode } from "./actions";

export function EmailForm({ next, defaultEmail }: { next: string; defaultEmail?: string }) {
  const [state, action] = useActionState(requestLoginCode, initialActionState);
  return (
    <form action={action} className="form" noValidate>
      <FormMessage state={state} />
      <input type="hidden" name="next" value={next} />
      <BotFields />
      <div className="field">
        <label htmlFor="email">Email address</label>
        <input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          required
          autoFocus
          defaultValue={state.values?.email ?? defaultEmail ?? ""}
          aria-describedby="email-error"
        />
        <FieldError state={state} name="email" />
      </div>
      <SubmitButton className="btn-block" pendingLabel="Sending…">
        Email me a sign-in code
      </SubmitButton>
    </form>
  );
}

/**
 * Submits straight to the Auth.js callback as a normal page navigation. The code is single-use, so it
 * must not go through a server action redirect, which the client router would fetch before navigating.
 */
export function CodeForm({ email, next }: { email: string; next: string }) {
  const [pending, setPending] = useState(false);
  return (
    <form
      action="/api/auth/callback/email"
      method="get"
      className="form"
      onSubmit={(e) => {
        const input = e.currentTarget.elements.namedItem("token") as HTMLInputElement;
        input.value = input.value.replace(/\D/g, "");
        setPending(true);
      }}
    >
      <input type="hidden" name="email" value={email} />
      <input type="hidden" name="callbackUrl" value={next} />
      <div className="field">
        <label htmlFor="code">6-digit code</label>
        <input
          id="code"
          name="token"
          inputMode="numeric"
          autoComplete="one-time-code"
          pattern="\s*[0-9]{3}\s?[0-9]{3}\s*"
          maxLength={8}
          required
          autoFocus
          title="Enter the 6-digit code from the email."
          style={{ fontSize: "1.6rem", letterSpacing: "0.4em", textAlign: "center" }}
        />
      </div>
      <button type="submit" className="btn btn-block" disabled={pending}>
        {pending ? "Checking…" : "Sign in"}
      </button>
    </form>
  );
}
