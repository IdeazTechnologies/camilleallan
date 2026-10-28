import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { isSafeRedirect } from "@/lib/utils";
import { ResetPasswordForm } from "../LoginForms";

export const metadata: Metadata = { title: "Reset password", robots: { index: false } };

async function ResetContent({ searchParams }: { searchParams: PageProps<"/login/reset">["searchParams"] }) {
  const params = await searchParams;
  const email = typeof params.email === "string" ? params.email : "";
  const nextParam = typeof params.next === "string" ? params.next : "";
  const next = isSafeRedirect(nextParam) ? nextParam : "/account";
  const token = typeof params.token === "string" ? params.token : undefined;

  if (!email) {
    return (
      <p className="text-center">
        This reset link is incomplete. <Link href="/login">Start again</Link>.
      </p>
    );
  }

  return (
    <>
      <p className="text-center">
        Choose a new password for <strong>{email}</strong>. Enter the 6-digit code from the email. It expires in 15
        minutes.
      </p>
      <ResetPasswordForm email={email} next={next} defaultCode={token} />
      <p className="muted text-center" style={{ fontSize: "var(--step--1)" }}>
        <Link href={`/login?email=${encodeURIComponent(email)}&next=${encodeURIComponent(next)}`}>Back to sign in</Link>
      </p>
    </>
  );
}

export default function ResetPage({ searchParams }: PageProps<"/login/reset">) {
  return (
    <div className="container-narrow section-tight" style={{ maxWidth: 460 }}>
      <div className="card stack stack-lg">
        <h1 className="text-center" style={{ fontSize: "var(--step-3)" }}>
          Reset your password
        </h1>
        <Suspense fallback={<div className="skeleton" style={{ height: 220 }} />}>
          <ResetContent searchParams={searchParams} />
        </Suspense>
      </div>
    </div>
  );
}
