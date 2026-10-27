"use client";

import Link from "next/link";
import { useActionState } from "react";
import { addToCartAction, type CartActionState } from "@/app/(site)/cart/actions";
import { SubmitButton } from "@/components/forms/SubmitButton";

type Props = { productId: string; stockQty: number; allowQuantity: boolean };

export function AddToCart({ productId, stockQty, allowQuantity }: Props) {
  const [state, action] = useActionState<CartActionState, FormData>(addToCartAction, {});

  if (stockQty <= 0) {
    return (
      <div className="stack stack-sm">
        <button type="button" className="btn btn-block" disabled>
          Sold
        </button>
        <p className="muted" style={{ fontSize: "var(--step--1)" }}>
          This piece has found its home. <Link href="/contact?type=custom_order">Ask about something similar</Link>.
        </p>
      </div>
    );
  }

  return (
    <form action={action} className="stack stack-sm">
      <input type="hidden" name="productId" value={productId} />
      <div className="cluster" style={{ flexWrap: "nowrap" }}>
        {allowQuantity && stockQty > 1 && (
          <label className="field" style={{ width: 96 }}>
            <span className="sr-only">Quantity</span>
            <input type="number" name="quantity" min={1} max={stockQty} defaultValue={1} className="input" />
          </label>
        )}
        <SubmitButton className="btn-block" pendingLabel="Adding…" style={{ flex: 1 }}>
          Add to cart
        </SubmitButton>
      </div>
      {state.message && (
        <p className={`alert ${state.ok ? "success" : "error"}`} role="status">
          {state.message}{" "}
          {state.ok && (
            <Link href="/cart" style={{ fontWeight: 500 }}>
              View cart →
            </Link>
          )}
        </p>
      )}
    </form>
  );
}
