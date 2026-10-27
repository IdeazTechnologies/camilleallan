"use server";

import { refresh } from "next/cache";
import { addItem, ensureCart, getCartId, setItemQuantity } from "@/lib/cart";
import { getCurrentUser } from "@/lib/dal";
import { releaseExpiredReservations } from "@/lib/orders";

export type CartActionState = { ok?: boolean; message?: string };

export async function addToCartAction(_prev: CartActionState, formData: FormData): Promise<CartActionState> {
  const productId = String(formData.get("productId") ?? "");
  const quantity = Math.max(1, Math.min(99, Number(formData.get("quantity") ?? 1) || 1));
  if (!productId) return { ok: false, message: "Something went wrong. Please refresh and try again." };

  const user = await getCurrentUser();
  const cartId = await ensureCart(user?.id ?? null);
  let result = await addItem(cartId, productId, quantity);
  if (!result.ok) {
    // Stock may be held by abandoned checkouts; free any expired reservations and retry once.
    const released = await releaseExpiredReservations(10);
    if (released.cancelled > 0) result = await addItem(cartId, productId, quantity);
  }
  refresh();
  return result;
}

export async function updateQuantityAction(formData: FormData) {
  const cartId = await getCartId();
  if (!cartId) return;
  const itemId = String(formData.get("itemId") ?? "");
  const quantity = Number(formData.get("quantity") ?? 0);
  await setItemQuantity(cartId, itemId, Number.isFinite(quantity) ? Math.floor(quantity) : 0);
  refresh();
}

export async function removeItemAction(formData: FormData) {
  const cartId = await getCartId();
  if (!cartId) return;
  await setItemQuantity(cartId, String(formData.get("itemId") ?? ""), 0);
  refresh();
}
