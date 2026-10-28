import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { isSafeRedirect } from "@/lib/utils";
import { VerifyForm } from "../LoginForms";

export const metadata: Metadata = { title: "Check your email", robots: { index: false } };

async function VerifyContent({ searchParams }: { searchParams: PageProps<"/login/verify">["searchParams"] }) {
  const params = await searchParams;
  const email = typeof params.email === "string" ? params.email : "";
  const purpose = params.purpose === "signup" ? "signup" : params.purpose === "login" ? "login" : null;
  const nextParam = typeof params.next === "string" ? params.next : "";
  const next = isSafeRedirect(nextParam) ? nextParam : "/account";
  const token = typeof params.token === "string" ? params.token : undefined;

  if (!email || !purpose) {
    return (
      <p className="text-center">
        This confirmation link is incomplete. <Link href="/login">Start again</Link>.
      </p>
    );
  }

  return (
    <>
      <p className="text-center">
        {purpose === "signup"
          ? "Enter the code we sent to finish creating your account."
          : "Enter the code we sent to confirm this browser."}{" "}
        It went to <strong>{email}</strong> and expires in 15 minutes.
      </p>
      <VerifyForm email={email} purpose={purpose} next={next} defaultCode={token} />
      <p className="muted text-center" style={{ fontSize: "var(--step--1)" }}>
        Didn’t get it? Check your spam folder, or <Link href={`/login?email=${encodeURIComponent(email)}&next=${encodeURIComponent(next)}`}>start again</Link>.
      </p>
    </>
  );
}

export default function VerifyPage({ searchParams }: PageProps<"/login/verify">) {
  return (
    <div className="container-narrow section-tight" style={{ maxWidth: 460 }}>
      <div className="card stack stack-lg">
        <h1 className="text-center" style={{ fontSize: "var(--step-3)" }}>
          Check your email
        </h1>
        <Suspense fallback={<div className="skeleton" style={{ height: 200 }} />}>
          <VerifyContent searchParams={searchParams} />
        </Suspense>
      </div>
    </div>
  );
}
