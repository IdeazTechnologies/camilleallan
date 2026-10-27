import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { getCurrentUser } from "@/lib/dal";
import { isSafeRedirect } from "@/lib/utils";
import { EmailForm } from "./LoginForms";

export const metadata: Metadata = { title: "Sign in", robots: { index: false } };

const ERRORS: Record<string, string> = {
  Verification: "That code or link has expired or was already used. Please request a new one.",
  TooManyAttempts: "Too many attempts. Please wait 15 minutes and request a new code.",
  EmailSignin: "We couldn't send the sign-in email. Please try again.",
  AccessDenied: "Access denied.",
  Configuration: "Sign-in is temporarily unavailable. Please try again later.",
};

async function LoginContent({ searchParams }: { searchParams: PageProps<"/login">["searchParams"] }) {
  const params = await searchParams;
  const nextParam = typeof params.next === "string" ? params.next : "";
  const next = isSafeRedirect(nextParam) ? nextParam : "/account";
  const user = await getCurrentUser();
  if (user) redirect(next === "/account" && user.role === "admin" ? "/admin" : next);
  const error = typeof params.error === "string" ? (ERRORS[params.error] ?? ERRORS.Verification) : null;
  const email = typeof params.email === "string" ? params.email : undefined;

  return (
    <>
      {error && <p className="alert error">{error}</p>}
      <EmailForm next={next} defaultEmail={email} />
    </>
  );
}

export default function LoginPage({ searchParams }: PageProps<"/login">) {
  return (
    <div className="container-narrow section-tight" style={{ maxWidth: 460 }}>
      <div className="card stack stack-lg">
        <header className="stack stack-sm text-center">
          <h1 style={{ fontSize: "var(--step-3)" }}>Sign in</h1>
          <p className="muted">
            No password needed. We&apos;ll email you a one-time code and link. New here? Entering your email creates
            your account.
          </p>
        </header>
        <Suspense fallback={<div className="skeleton" style={{ height: 160 }} />}>
          <LoginContent searchParams={searchParams} />
        </Suspense>
      </div>
    </div>
  );
}
