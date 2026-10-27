import { desc, eq } from "drizzle-orm";
import type { Metadata } from "next";
import { Suspense } from "react";
import { db } from "@/db";
import { addresses } from "@/db/schema";
import { formatAddressLines } from "@/lib/address";
import { requireUser } from "@/lib/dal";
import { AddAddressForm } from "../AccountForms";
import { AccountNav } from "../AccountNav";
import { deleteAddressAction, setDefaultAddressAction } from "../actions";

export const metadata: Metadata = { title: "Addresses", robots: { index: false } };

async function AddressesContent() {
  const user = await requireUser("/account/addresses");
  const list = await db.query.addresses.findMany({
    where: eq(addresses.userId, user.id),
    orderBy: [desc(addresses.isDefault), desc(addresses.createdAt)],
  });
  return (
    <>
      <AccountNav current="/account/addresses" />
      <div className="form-row" style={{ alignItems: "start" }}>
        <section className="stack">
          <h2 style={{ fontSize: "var(--step-2)" }}>Saved addresses</h2>
          {list.length === 0 && <p className="muted">No saved addresses yet.</p>}
          {list.map((a) => (
            <div key={a.id} className="card stack stack-sm">
              {a.isDefault && <span className="badge accent" style={{ justifySelf: "start" }}>Default</span>}
              <address style={{ fontStyle: "normal" }}>
                {formatAddressLines(a).map((l, i) => (
                  <div key={i}>{l}</div>
                ))}
              </address>
              <div className="cluster">
                {!a.isDefault && (
                  <form action={setDefaultAddressAction}>
                    <input type="hidden" name="id" value={a.id} />
                    <button className="link-button" type="submit">
                      Make default
                    </button>
                  </form>
                )}
                <form action={deleteAddressAction}>
                  <input type="hidden" name="id" value={a.id} />
                  <button className="link-button danger" type="submit">
                    Delete
                  </button>
                </form>
              </div>
            </div>
          ))}
        </section>
        <section className="card stack">
          <h2 style={{ fontSize: "var(--step-2)" }}>Add an address</h2>
          <AddAddressForm />
        </section>
      </div>
    </>
  );
}

export default function AddressesPage() {
  return (
    <div className="container" style={{ paddingBottom: "var(--space-8)" }}>
      <header className="page-header">
        <h1>Addresses</h1>
      </header>
      <Suspense fallback={<div className="skeleton" style={{ height: 320 }} />}>
        <AddressesContent />
      </Suspense>
    </div>
  );
}
