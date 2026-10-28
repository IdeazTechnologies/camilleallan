"use client";

import { useActionState, useMemo, useState } from "react";
import { AddressFields } from "@/components/forms/AddressFields";
import { FormMessage } from "@/components/forms/FormMessage";
import { SubmitButton } from "@/components/forms/SubmitButton";
import { computeTotals, shippingOptionsFor, type ShippingRuleLike } from "@/lib/pricing";
import { formatMoney } from "@/lib/utils";
import { placeOrderAction, type CheckoutState } from "./actions";

type Line = { title: string; quantity: number; unitPriceCents: number };
type SavedCard = { id: string; label: string };
type AddressDefaults = Record<string, string | null>;

type Props = {
  lines: Line[];
  subtotalCents: number;
  rules: ShippingRuleLike[];
  tax: { ratePercent: number; includeShipping: boolean; label: string };
  currency: string;
  countries: string[];
  userEmail: string | null;
  addressDefaults: AddressDefaults;
  savedCards: SavedCard[];
  canSaveCard: boolean;
  simulate: boolean;
};

export function CheckoutForm(props: Props) {
  const [state, action] = useActionState<CheckoutState, FormData>(placeOrderAction, {});
  const [country, setCountry] = useState(
    state.values?.ship_country ?? props.addressDefaults.country ?? (props.countries.length ? props.countries[0] : "US"),
  );
  const [billingSame, setBillingSame] = useState(true);
  const [shippingRuleId, setShippingRuleId] = useState<string | null>(null);
  const [cardChoice, setCardChoice] = useState(props.savedCards[0]?.id ?? "new");

  const itemCount = props.lines.reduce((n, l) => n + l.quantity, 0);
  const options = useMemo(
    () => shippingOptionsFor(props.rules, { country, subtotalCents: props.subtotalCents, itemCount }),
    [props.rules, country, props.subtotalCents, itemCount],
  );
  const selected = options.find((o) => o.id === shippingRuleId) ?? options[0] ?? null;
  const totals = computeTotals(props.lines, selected?.costCents ?? 0, props.tax);
  const money = (c: number) => formatMoney(c, props.currency);

  return (
    <form action={action} className="checkout-grid" noValidate>
      <div className="stack stack-lg">
        <FormMessage state={state} />

        <section className="stack">
          <h2 style={{ fontSize: "var(--step-2)" }}>Contact</h2>
          {props.userEmail ? (
            <p>
              Signed in as <strong>{props.userEmail}</strong>
            </p>
          ) : (
            <div className="field">
              <label htmlFor="email">Email</label>
              <input id="email" name="email" type="email" autoComplete="email" required defaultValue={state.values?.email ?? ""} />
              {state.errors?.email && <span className="error">{state.errors.email}</span>}
              <span className="hint">Your receipt and shipping updates go here.</span>
            </div>
          )}
          <label className="check">
            <input type="checkbox" name="newsletter" defaultChecked={state.values?.newsletter === "on"} />
            Email me about new sculptures (a few times a year)
          </label>
        </section>

        <section className="stack">
          <h2 style={{ fontSize: "var(--step-2)" }}>Shipping address</h2>
          <AddressFields
            prefix="ship_"
            state={state}
            defaults={props.addressDefaults}
            countries={props.countries}
            onCountryChange={setCountry}
          />
          {props.userEmail && (
            <label className="check">
              <input type="checkbox" name="saveAddress" />
              Save this address to my account
            </label>
          )}
        </section>

        <section className="stack">
          <h2 style={{ fontSize: "var(--step-2)" }}>Shipping method</h2>
          {options.length === 0 ? (
            <p className="alert warning">Sorry, we don&apos;t currently ship to this country. Please contact us for options.</p>
          ) : (
            <div className="stack stack-sm" role="radiogroup">
              {options.map((o) => (
                <label key={o.id} className="radio-card">
                  <input
                    type="radio"
                    name="shippingRuleId"
                    value={o.id}
                    checked={selected?.id === o.id}
                    onChange={() => setShippingRuleId(o.id)}
                  />
                  <span className="stack" style={{ gap: 0 }}>
                    <span>{o.name}</span>
                    {o.description && <span className="muted" style={{ fontSize: "var(--step--1)" }}>{o.description}</span>}
                  </span>
                  <span className="radio-card-price">{o.costCents === 0 ? "Free" : money(o.costCents)}</span>
                </label>
              ))}
            </div>
          )}
          {state.errors?.shippingRuleId && <span className="error">{state.errors.shippingRuleId}</span>}
        </section>

        <section className="stack">
          <h2 style={{ fontSize: "var(--step-2)" }}>Payment</h2>
          {props.savedCards.length > 0 && (
            <div className="stack stack-sm">
              {props.savedCards.map((c) => (
                <label key={c.id} className="radio-card">
                  <input type="radio" name="savedCardId" value={c.id} checked={cardChoice === c.id} onChange={() => setCardChoice(c.id)} />
                  {c.label}
                </label>
              ))}
              <label className="radio-card">
                <input type="radio" name="savedCardId" value="new" checked={cardChoice === "new"} onChange={() => setCardChoice("new")} />
                Use a new card
              </label>
            </div>
          )}
          {cardChoice === "new" && (
            <div className="stack stack-sm">
              <div className="field">
                <label htmlFor="cardNumber">
                  Card number <span className="muted">(Visa or Mastercard)</span>
                </label>
                <input
                  id="cardNumber"
                  name="cardNumber"
                  inputMode="numeric"
                  autoComplete="cc-number"
                  maxLength={23}
                  required
                  aria-invalid={!!state.errors?.cardNumber || undefined}
                />
                {state.errors?.cardNumber && <span className="error">{state.errors.cardNumber}</span>}
              </div>
              <div className="form-row">
                <div className="field">
                  <label htmlFor="cardExpiry">Expiry (MM/YY)</label>
                  <input
                    id="cardExpiry"
                    name="cardExpiry"
                    inputMode="numeric"
                    autoComplete="cc-exp"
                    placeholder="MM/YY"
                    maxLength={7}
                    required
                    aria-invalid={!!state.errors?.cardExpiry || undefined}
                  />
                  {state.errors?.cardExpiry && <span className="error">{state.errors.cardExpiry}</span>}
                </div>
                <div className="field">
                  <label htmlFor="cardCvv">Security code (CVV)</label>
                  <input
                    id="cardCvv"
                    name="cardCvv"
                    inputMode="numeric"
                    autoComplete="cc-csc"
                    maxLength={4}
                    required
                    aria-invalid={!!state.errors?.cardCvv || undefined}
                  />
                  {state.errors?.cardCvv && <span className="error">{state.errors.cardCvv}</span>}
                </div>
              </div>
              <p className="muted" style={{ fontSize: "var(--step--1)" }}>
                Your card is charged securely through PSiGate. We never store your card number or security code.
                {props.simulate && (
                  <strong> Test mode: no real charge. Use 4111 1111 1111 1111 to approve or 4000 0000 0000 0002 to decline.</strong>
                )}
              </p>
            </div>
          )}
          {cardChoice === "new" && props.canSaveCard && (
            <label className="check">
              <input type="checkbox" name="saveCard" />
              Remember this card for next time (stored securely by PSiGate)
            </label>
          )}

          <label className="check">
            <input type="checkbox" name="billingSame" checked={billingSame} onChange={(e) => setBillingSame(e.target.checked)} />
            Billing address is the same as shipping
          </label>
          {!billingSame && <AddressFields prefix="bill_" state={state} />}
        </section>

        <section className="field">
          <label htmlFor="customerNote">Order notes (optional)</label>
          <textarea id="customerNote" name="customerNote" maxLength={2000} defaultValue={state.values?.customerNote ?? ""} />
        </section>
      </div>

      <aside className="panel stack checkout-summary">
        <h2 style={{ fontSize: "var(--step-2)" }}>Order summary</h2>
        <ul className="stack stack-sm" style={{ listStyle: "none", padding: 0 }}>
          {props.lines.map((l, i) => (
            <li key={i} className="spread" style={{ flexWrap: "nowrap" }}>
              <span>
                {l.title} {l.quantity > 1 && <span className="muted">× {l.quantity}</span>}
              </span>
              <span className="price">{money(l.unitPriceCents * l.quantity)}</span>
            </li>
          ))}
        </ul>
        <dl className="summary-list">
          <div>
            <dt>Subtotal</dt>
            <dd>{money(totals.subtotalCents)}</dd>
          </div>
          <div>
            <dt>Shipping</dt>
            <dd>{selected ? (selected.costCents === 0 ? "Free" : money(selected.costCents)) : "-"}</dd>
          </div>
          {totals.taxCents > 0 && (
            <div>
              <dt>{props.tax.label}</dt>
              <dd>{money(totals.taxCents)}</dd>
            </div>
          )}
          <div className="total">
            <dt>Total</dt>
            <dd>
              {money(totals.totalCents)} <span className="muted" style={{ fontSize: "0.7em" }}>{props.currency}</span>
            </dd>
          </div>
        </dl>
        <SubmitButton className="btn-block btn-accent" pendingLabel="Processing payment…" disabled={options.length === 0}>
          {`Pay ${money(totals.totalCents)}`}
        </SubmitButton>
      </aside>
    </form>
  );
}
