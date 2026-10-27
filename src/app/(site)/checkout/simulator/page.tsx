import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { getPsigateConfig } from "@/lib/payments/psigate";
import { simulatePayment } from "./actions";

export const metadata: Metadata = { title: "Payment simulator", robots: { index: false } };

async function Simulator({ searchParams }: { searchParams: PageProps<"/checkout/simulator">["searchParams"] }) {
  const params = await searchParams;
  if (getPsigateConfig()?.mode !== "simulate") notFound();
  const get = (k: string) => (typeof params[k] === "string" ? (params[k] as string) : "");

  return (
    <div className="card stack">
      <p className="alert warning">
        Test mode. This page stands in for PSiGate&apos;s hosted payment page. No card is charged.
      </p>
      <dl className="summary-list">
        <div>
          <dt>Order</dt>
          <dd>{get("OrderID")}</dd>
        </div>
        <div>
          <dt>Customer</dt>
          <dd>{get("Email")}</dd>
        </div>
        <div className="total">
          <dt>Amount</dt>
          <dd>${get("SubTotal")}</dd>
        </div>
      </dl>
      <form action={simulatePayment} className="cluster">
        {["OrderID", "SubTotal", "ThanksURL", "NoThanksURL"].map((k) => (
          <input key={k} type="hidden" name={k} value={get(k)} />
        ))}
        <button type="submit" name="decision" value="approve" className="btn btn-accent">
          Approve payment
        </button>
        <button type="submit" name="decision" value="decline" className="btn btn-outline">
          Decline payment
        </button>
      </form>
    </div>
  );
}

export default function SimulatorPage({ searchParams }: PageProps<"/checkout/simulator">) {
  return (
    <div className="container-narrow section-tight" style={{ maxWidth: 520 }}>
      <h1 style={{ fontSize: "var(--step-3)", marginBottom: "var(--space-5)" }}>Secure payment</h1>
      <Suspense fallback={<div className="skeleton" style={{ height: 240 }} />}>
        <Simulator searchParams={searchParams} />
      </Suspense>
    </div>
  );
}
