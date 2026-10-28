"use client";

import Link from "next/link";
import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { BotFields } from "@/components/forms/BotFields";
import { FieldError, FormMessage } from "@/components/forms/FormMessage";
import { SubmitButton } from "@/components/forms/SubmitButton";
import { resetPassword, submitLogin, verifyCode } from "./actions";
import { initialLoginState, type LoginState } from "./types";

export function LoginFlow({ next, defaultEmail }: { next: string; defaultEmail?: string }) {
  const [state, action] = useActionState(submitLogin, initialLoginState);
  const step = state.step ?? "email";
  const email = state.email ?? defaultEmail ?? "";

  return (
    <>
      {step === "email" && <EmailStep action={action} state={state} next={next} email={email} />}
      {step === "password" && (
        <PasswordStep
          action={action}
          state={state}
          next={next}
          email={email}
          needsPasswordSetup={!!state.needsPasswordSetup}
        />
      )}
      {step === "signup" && <SignupStep action={action} state={state} next={next} email={email} />}
    </>
  );
}

function EmailStep({
  action,
  state,
  next,
  email,
}: {
  action: (payload: FormData) => void;
  state: LoginState;
  next: string;
  email: string;
}) {
  return (
    <>
      <header className="stack stack-sm text-center">
        <h1 style={{ fontSize: "var(--step-3)" }}>Sign in</h1>
        <p className="muted">Enter your email and we’ll take it from there. New here? You can create an account.</p>
      </header>
      <form action={action} className="form" noValidate>
        <FormMessage state={state} />
        <input type="hidden" name="intent" value="email" />
        <input type="hidden" name="next" value={next} />
        <BotFields />
        <div className="field">
          <label htmlFor="email">Email address</label>
          <input
            id="email"
            name="email"
            type="email"
            autoComplete="username"
            required
            autoFocus
            defaultValue={state.values?.email ?? email}
            aria-describedby="email-error"
          />
          <FieldError state={state} name="email" />
        </div>
        <SubmitButton className="btn-block" pendingLabel="Checking…">
          Continue
        </SubmitButton>
      </form>
    </>
  );
}

function PasswordStep({
  action,
  state,
  next,
  email,
  needsPasswordSetup,
}: {
  action: (payload: FormData) => void;
  state: LoginState;
  next: string;
  email: string;
  needsPasswordSetup: boolean;
}) {
  return (
    <>
      <header className="stack stack-sm text-center">
        <h1 style={{ fontSize: "var(--step-3)" }}>Welcome back</h1>
        <p className="muted">
          {needsPasswordSetup
            ? "We found your account, but it doesn’t have a password yet. We’ll email you a link to create one."
            : "Enter your password. On a new browser, we’ll also email you a short code."}
        </p>
      </header>
      {needsPasswordSetup ? (
        <div className="stack">
          <EmailLine email={email} next={next} />
          <form action={action} className="form">
            <FormMessage state={state} />
            <input type="hidden" name="intent" value="reset" />
            <input type="hidden" name="email" value={email} />
            <input type="hidden" name="next" value={next} />
            <BotFields />
            <SubmitButton className="btn-block" pendingLabel="Sending…">
              Email me a link to set a password
            </SubmitButton>
          </form>
        </div>
      ) : (
        <div className="stack">
          <form action={action} className="form" noValidate>
            <FormMessage state={state} />
            <input type="hidden" name="intent" value="password" />
            <input type="hidden" name="next" value={next} />
            <div className="field">
              <label htmlFor="email">Email address</label>
              <input id="email" name="email" type="email" autoComplete="username" readOnly value={email} />
            </div>
            <div className="field">
              <label htmlFor="password">Password</label>
              <input
                id="password"
                name="password"
                type="password"
                autoComplete="current-password"
                required
                autoFocus
                aria-describedby="password-error"
              />
              <FieldError state={state} name="password" />
            </div>
            <SubmitButton className="btn-block" pendingLabel="Signing in…">
              Sign in
            </SubmitButton>
          </form>
          <p className="text-center" style={{ margin: 0 }}>
            <DifferentEmail email={email} next={next} />
          </p>
          <form action={action} className="text-center">
            <input type="hidden" name="intent" value="reset" />
            <input type="hidden" name="email" value={email} />
            <input type="hidden" name="next" value={next} />
            <BotFields />
            <TextSubmit pendingLabel="Sending…">Forgot your password?</TextSubmit>
          </form>
        </div>
      )}
    </>
  );
}

function SignupStep({
  action,
  state,
  next,
  email,
}: {
  action: (payload: FormData) => void;
  state: LoginState;
  next: string;
  email: string;
}) {
  return (
    <>
      <header className="stack stack-sm text-center">
        <h1 style={{ fontSize: "var(--step-3)" }}>Create your account</h1>
        <p className="alert">
          We couldn’t find an account for <strong>{email}</strong>. If this is the right address, create one below and
          we’ll email you a code to confirm it.
        </p>
      </header>
      <form action={action} className="form" noValidate>
        <FormMessage state={state} />
        <input type="hidden" name="intent" value="signup" />
        <input type="hidden" name="next" value={next} />
        <input type="hidden" name="email" value={email} />
        <BotFields />
        <div className="field">
          <label htmlFor="name">Your name</label>
          <input
            id="name"
            name="name"
            autoComplete="name"
            required
            autoFocus
            defaultValue={state.values?.name ?? ""}
            aria-describedby="name-error"
          />
          <FieldError state={state} name="name" />
        </div>
        <div className="field">
          <label htmlFor="password">Password</label>
          <input
            id="password"
            name="password"
            type="password"
            autoComplete="new-password"
            required
            minLength={8}
            aria-describedby="password-error"
          />
          <FieldError state={state} name="password" />
        </div>
        <div className="field">
          <label htmlFor="confirm">Confirm password</label>
          <input
            id="confirm"
            name="confirm"
            type="password"
            autoComplete="new-password"
            required
            minLength={8}
            aria-describedby="confirm-error"
          />
          <FieldError state={state} name="confirm" />
        </div>
        <SubmitButton className="btn-block" pendingLabel="Sending code…">
          Create account
        </SubmitButton>
      </form>
      <p className="text-center" style={{ margin: 0 }}>
        <DifferentEmail email={email} next={next} />
      </p>
    </>
  );
}

function DifferentEmail({ email, next }: { email: string; next: string }) {
  return <Link href={`/login?${new URLSearchParams({ email, next })}`}>Use a different email</Link>;
}

function EmailLine({ email, next }: { email: string; next: string }) {
  return (
    <p className="text-center" style={{ margin: 0 }}>
      <strong>{email}</strong>
      <br />
      <DifferentEmail email={email} next={next} />
    </p>
  );
}

function TextSubmit({ children, pendingLabel }: { children: string; pendingLabel: string }) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" className="link-button" disabled={pending}>
      {pending ? pendingLabel : children}
    </button>
  );
}

export function VerifyForm({
  email,
  purpose,
  next,
  defaultCode,
}: {
  email: string;
  purpose: "login" | "signup";
  next: string;
  defaultCode?: string;
}) {
  const [state, action] = useActionState(verifyCode, initialLoginState);
  return (
    <form action={action} className="form" noValidate>
      <FormMessage state={state} />
      <input type="hidden" name="email" value={email} />
      <input type="hidden" name="purpose" value={purpose} />
      <input type="hidden" name="next" value={next} />
      <div className="field">
        <label htmlFor="code">6-digit code</label>
        <input
          id="code"
          name="code"
          inputMode="numeric"
          autoComplete="one-time-code"
          defaultValue={defaultCode ?? ""}
          required
          autoFocus
          style={{ fontSize: "1.6rem", letterSpacing: "0.4em", textAlign: "center" }}
        />
      </div>
      <SubmitButton className="btn-block" pendingLabel="Checking…">
        Confirm
      </SubmitButton>
    </form>
  );
}

export function ResetPasswordForm({ email, next, defaultCode }: { email: string; next: string; defaultCode?: string }) {
  const [state, action] = useActionState(resetPassword, initialLoginState);
  return (
    <form action={action} className="form" noValidate>
      <FormMessage state={state} />
      <input type="hidden" name="email" value={email} />
      <input type="hidden" name="next" value={next} />
      <div className="field">
        <label htmlFor="code">6-digit code</label>
        <input
          id="code"
          name="code"
          inputMode="numeric"
          autoComplete="one-time-code"
          defaultValue={defaultCode ?? ""}
          required
          autoFocus
          style={{ fontSize: "1.6rem", letterSpacing: "0.4em", textAlign: "center" }}
        />
      </div>
      <div className="field">
        <label htmlFor="password">New password</label>
        <input
          id="password"
          name="password"
          type="password"
          autoComplete="new-password"
          required
          minLength={8}
          aria-describedby="password-error"
        />
        <FieldError state={state} name="password" />
      </div>
      <div className="field">
        <label htmlFor="confirm">Confirm password</label>
        <input id="confirm" name="confirm" type="password" autoComplete="new-password" required minLength={8} aria-describedby="confirm-error" />
        <FieldError state={state} name="confirm" />
      </div>
      <SubmitButton className="btn-block" pendingLabel="Saving…">
        Save password
      </SubmitButton>
    </form>
  );
}
