import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { isSafeRedirect } from "@/lib/utils";
import { CodeForm } from "../LoginForms";

export const metadata: Metadata = { title: "Check your email", robots: { index: false } };

async function CheckEmailContent({ searchParams }: { searchParams: PageProps<"/login/check-email">["searchParams"] }) {
  const params = await searchParams;
  const email = typeof params.email === "string" ? params.email : "";
  const nextParam = typeof params.next === "string" ? params.next : "";
  const next = isSafeRedirect(nextParam) ? nextParam : "/account";

  if (!email) {
    return (
      <p>
        We sent you a sign-in link. Open it on this device to continue, or <Link href="/login">start again</Link>.
      </p>
    );
  }
  return (
    <>
      <p className="text-center">
        We sent a 6-digit code to <strong>{email}</strong>. Enter it below, or click the link in the email. The code
        expires in 15 minutes.
      </p>
      <CodeForm email={email} next={next} />
      <p className="muted text-center" style={{ fontSize: "var(--step--1)" }}>
        Didn&apos;t get it? Check your spam folder, or{" "}
        <Link href={`/login?${new URLSearchParams({ email, next })}`}>send a new code</Link>.
      </p>
    </>
  );
}

export default function CheckEmailPage({ searchParams }: PageProps<"/login/check-email">) {
  return (
    <div className="container-narrow section-tight" style={{ maxWidth: 460 }}>
      <div className="card stack stack-lg">
        <h1 className="text-center" style={{ fontSize: "var(--step-3)" }}>
          Check your email
        </h1>
        <Suspense fallback={<div className="skeleton" style={{ height: 200 }} />}>
          <CheckEmailContent searchParams={searchParams} />
        </Suspense>
      </div>
    </div>
  );
}
