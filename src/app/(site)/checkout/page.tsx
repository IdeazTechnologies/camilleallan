import { asc, desc, eq } from "drizzle-orm";
import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import { Suspense } from "react";
import { Banners } from "@/components/site/Banners";
import { db } from "@/db";
import { addresses, savedCards, shippingRules } from "@/db/schema";
import { getCart } from "@/lib/cart";
import { getCurrentUser } from "@/lib/dal";
import { getPsigateConfig } from "@/lib/payments/psigate";
import { readSettingsFresh } from "@/lib/settings";
import { CheckoutForm } from "./CheckoutForm";

export const metadata: Metadata = { title: "Checkout", robots: { index: false } };

async function CheckoutContent() {
  await connection();
  const [cart, user, settings] = await Promise.all([getCart(), getCurrentUser(), readSettingsFresh()]);
  if (!cart || cart.lines.length === 0) redirect("/cart");
  if (cart.hasProblems) redirect("/cart");

  const config = getPsigateConfig();
  if (!config) {
    return (
      <p className="alert warning">
        Online payment is temporarily unavailable. Please <Link href="/contact">contact us</Link> to complete your order.
      </p>
    );
  }

  const [rules, defaultAddress, cards] = await Promise.all([
    db.query.shippingRules.findMany({ where: eq(shippingRules.active, true), orderBy: [asc(shippingRules.sortOrder)] }),
    user
      ? db.query.addresses.findFirst({ where: eq(addresses.userId, user.id), orderBy: [desc(addresses.isDefault), desc(addresses.createdAt)] })
      : null,
    user && config.savedCardsEnabled
      ? db.query.savedCards.findMany({ where: eq(savedCards.userId, user.id), orderBy: [desc(savedCards.createdAt)] })
      : [],
  ]);

  const lines = cart.lines.filter((l) => l.available);

  return (
    <>
      {!user && (
        <p className="muted" style={{ marginBottom: "var(--space-5)" }}>
          Have an account? <Link href="/login?next=/checkout">Sign in</Link> for faster checkout, or continue as a guest.
        </p>
      )}
      <CheckoutForm
        lines={lines.map((l) => ({ title: l.title, quantity: l.quantity, unitPriceCents: l.unitPriceCents }))}
        subtotalCents={cart.subtotalCents}
        rules={rules}
        tax={{ ratePercent: settings.taxRatePercent, includeShipping: settings.taxShipping, label: settings.taxLabel }}
        currency={settings.currency}
        countries={settings.shipToCountries}
        userEmail={user?.email ?? null}
        addressDefaults={{
          name: defaultAddress?.name ?? user?.name ?? null,
          line1: defaultAddress?.line1 ?? null,
          line2: defaultAddress?.line2 ?? null,
          city: defaultAddress?.city ?? null,
          region: defaultAddress?.region ?? null,
          postalCode: defaultAddress?.postalCode ?? null,
          country: defaultAddress?.country ?? null,
          phone: defaultAddress?.phone ?? null,
        }}
        savedCards={cards.map((c) => ({
          id: c.id,
          label: `${c.cardType ?? "Card"} ending ${c.last4 ?? "????"}${c.expMonth && c.expYear ? ` (exp ${c.expMonth}/${c.expYear})` : ""}`,
        }))}
        canSaveCard={!!user && config.savedCardsEnabled}
        simulate={config.mode === "simulate"}
      />
    </>
  );
}

export default function CheckoutPage() {
  return (
    <div className="container" style={{ paddingBottom: "var(--space-8)" }}>
      <header className="page-header">
        <h1>Checkout</h1>
      </header>
      <Banners placement="checkout" className="mt-4" />
      <div style={{ marginTop: "var(--space-5)" }}>
        <Suspense fallback={<div className="skeleton" style={{ height: 480 }} />}>
          <CheckoutContent />
        </Suspense>
      </div>
    </div>
  );
}
