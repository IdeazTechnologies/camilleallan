import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { ImagePlaceholder, SiteImage } from "@/components/SiteImage";
import { Banners } from "@/components/site/Banners";
import { getCart } from "@/lib/cart";
import { formatMoney } from "@/lib/utils";
import { removeItemAction, updateQuantityAction } from "./actions";
import styles from "./cart.module.css";

export const metadata: Metadata = { title: "Cart", robots: { index: false } };

async function CartContent() {
  const cart = await getCart();
  if (!cart || cart.lines.length === 0) {
    return (
      <div className="empty-state">
        <p className="lede">Your cart is empty.</p>
        <Link href="/shop" className="btn">
          Visit the shop
        </Link>
      </div>
    );
  }

  return (
    <div className={styles.layout}>
      <ul className={styles.lines}>
        {cart.lines.map((line) => (
          <li key={line.itemId} className={styles.line} data-unavailable={!line.available || undefined}>
            <Link href={`/product/${line.slug}`} className={styles.thumb}>
              {line.imageUrl ? <SiteImage src={line.imageUrl} alt="" fill sizes="96px" /> : <ImagePlaceholder />}
            </Link>
            <div className="stack stack-sm">
              <Link href={`/product/${line.slug}`} className={styles.title}>
                {line.title}
              </Link>
              <span className="price">{formatMoney(line.unitPriceCents)}</span>
              {line.problem && <span className="badge danger">{line.problem}</span>}
            </div>
            <div className={styles.controls}>
              {line.maxQuantity > 1 && line.available ? (
                <form action={updateQuantityAction} className="cluster" style={{ flexWrap: "nowrap", gap: "var(--space-2)" }}>
                  <input type="hidden" name="itemId" value={line.itemId} />
                  <label className="sr-only" htmlFor={`qty-${line.itemId}`}>
                    Quantity
                  </label>
                  <input
                    id={`qty-${line.itemId}`}
                    className="input"
                    style={{ width: 76, minHeight: 38 }}
                    type="number"
                    name="quantity"
                    min={0}
                    max={line.maxQuantity}
                    defaultValue={line.quantity}
                  />
                  <button type="submit" className="btn btn-ghost btn-sm">
                    Update
                  </button>
                </form>
              ) : (
                <span className="muted">Qty {line.quantity}</span>
              )}
              <form action={removeItemAction}>
                <input type="hidden" name="itemId" value={line.itemId} />
                <button type="submit" className="link-button danger" style={{ fontSize: "var(--step--1)" }}>
                  Remove
                </button>
              </form>
            </div>
            <span className={`price ${styles.lineTotal}`}>{formatMoney(line.unitPriceCents * line.quantity)}</span>
          </li>
        ))}
      </ul>

      <aside className="panel stack">
        <h2 style={{ fontSize: "var(--step-2)" }}>Summary</h2>
        <dl className="summary-list">
          <div>
            <dt>Subtotal</dt>
            <dd>{formatMoney(cart.subtotalCents)}</dd>
          </div>
          <div>
            <dt>Shipping</dt>
            <dd className="muted">Calculated at checkout</dd>
          </div>
        </dl>
        {cart.hasProblems && (
          <p className="alert warning">Please remove unavailable items before checking out.</p>
        )}
        <Link
          href="/checkout"
          className="btn btn-block btn-accent"
          aria-disabled={cart.hasProblems || undefined}
          tabIndex={cart.hasProblems ? -1 : undefined}
        >
          Checkout
        </Link>
        <Link href="/shop" className="text-center" style={{ fontSize: "var(--step--1)" }}>
          Continue shopping
        </Link>
      </aside>
    </div>
  );
}

export default function CartPage() {
  return (
    <div className="container" style={{ paddingBottom: "var(--space-8)" }}>
      <header className="page-header">
        <h1>Your cart</h1>
      </header>
      <Banners placement="cart" className="mt-4" />
      <Suspense fallback={<div className="skeleton" style={{ height: 240 }} />}>
        <CartContent />
      </Suspense>
    </div>
  );
}
