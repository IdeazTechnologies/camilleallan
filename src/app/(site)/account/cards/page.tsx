import { desc, eq } from "drizzle-orm";
import type { Metadata } from "next";
import { Suspense } from "react";
import { db } from "@/db";
import { savedCards } from "@/db/schema";
import { requireUser } from "@/lib/dal";
import { getPsigateConfig } from "@/lib/payments/psigate";
import { formatDate } from "@/lib/utils";
import { AccountNav } from "../AccountNav";
import { deleteSavedCardAction } from "../actions";

export const metadata: Metadata = { title: "Saved cards", robots: { index: false } };

async function CardsContent() {
  const user = await requireUser("/account/cards");
  const enabled = getPsigateConfig()?.savedCardsEnabled ?? false;
  const cards = await db.query.savedCards.findMany({
    where: eq(savedCards.userId, user.id),
    orderBy: [desc(savedCards.createdAt)],
  });
  return (
    <>
      <AccountNav current="/account/cards" />
      <div className="stack" style={{ maxWidth: 640 }}>
        <p className="muted">
          Card details are held securely by PSiGate, our payment processor. We only keep the card type, last four digits
          and expiry so you can recognize it.
        </p>
        {!enabled && <p className="alert">Saving cards for faster checkout is not currently available.</p>}
        {cards.length === 0 ? (
          <p className="muted">You have no saved cards.</p>
        ) : (
          cards.map((c) => (
            <div key={c.id} className="card spread">
              <div className="stack" style={{ gap: 0 }}>
                <strong>
                  {c.cardType ?? "Card"} ending {c.last4 ?? "????"}
                </strong>
                <span className="muted" style={{ fontSize: "var(--step--1)" }}>
                  {c.expMonth && c.expYear ? `Expires ${c.expMonth}/${c.expYear} · ` : ""}Saved {formatDate(c.createdAt)}
                </span>
              </div>
              <form action={deleteSavedCardAction}>
                <input type="hidden" name="id" value={c.id} />
                <button type="submit" className="btn btn-outline btn-sm">
                  Remove
                </button>
              </form>
            </div>
          ))
        )}
      </div>
    </>
  );
}

export default function CardsPage() {
  return (
    <div className="container" style={{ paddingBottom: "var(--space-8)" }}>
      <header className="page-header">
        <h1>Saved cards</h1>
      </header>
      <Suspense fallback={<div className="skeleton" style={{ height: 240 }} />}>
        <CardsContent />
      </Suspense>
    </div>
  );
}
