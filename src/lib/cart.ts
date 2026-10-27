import "server-only";
import { and, asc, eq, sql } from "drizzle-orm";
import { cookies } from "next/headers";
import { connection } from "next/server";
import { db } from "@/db";
import { cartItems, carts, productImages, products } from "@/db/schema";
import { subtotalOf } from "@/lib/pricing";

export const CART_COOKIE = "ca_cart";

export type CartLine = {
  itemId: string;
  productId: string;
  slug: string;
  title: string;
  sku: string | null;
  unitPriceCents: number;
  compareAtCents: number | null;
  quantity: number;
  maxQuantity: number;
  imageUrl: string | null;
  available: boolean;
  problem: string | null;
};

export type Cart = {
  id: string;
  lines: CartLine[];
  subtotalCents: number;
  itemCount: number;
  hasProblems: boolean;
};

export async function getCartId() {
  const jar = await cookies();
  // The cart query that follows may open a pg connection, which needs request-time random bytes.
  await connection();
  return jar.get(CART_COOKIE)?.value ?? null;
}

export async function loadCart(cartId: string | null): Promise<Cart | null> {
  if (!cartId) return null;
  const cart = await db.query.carts.findFirst({
    where: eq(carts.id, cartId),
    with: {
      items: {
        orderBy: [asc(cartItems.createdAt)],
        with: {
          product: {
            with: { images: { orderBy: [asc(productImages.sortOrder)], limit: 1 } },
          },
        },
      },
    },
  });
  if (!cart) return null;

  const lines: CartLine[] = cart.items.map((item) => {
    const p = item.product;
    let problem: string | null = null;
    if (p.status !== "published") problem = "This piece is no longer available.";
    else if (p.stockQty <= 0) problem = "Sorry, this piece has just sold.";
    else if (item.quantity > p.stockQty) problem = `Only ${p.stockQty} available.`;
    return {
      itemId: item.id,
      productId: p.id,
      slug: p.slug,
      title: p.title,
      sku: p.sku,
      unitPriceCents: p.priceCents,
      compareAtCents: p.compareAtCents,
      quantity: item.quantity,
      maxQuantity: Math.max(0, p.stockQty),
      imageUrl: p.images[0]?.url ?? null,
      available: problem === null,
      problem,
    };
  });
  const purchasable = lines.filter((l) => l.available);
  return {
    id: cart.id,
    lines,
    subtotalCents: subtotalOf(purchasable),
    itemCount: lines.reduce((n, l) => n + l.quantity, 0),
    hasProblems: lines.some((l) => !l.available),
  };
}

export async function getCart() {
  return loadCart(await getCartId());
}

export async function getCartCount() {
  const cartId = await getCartId();
  if (!cartId) return 0;
  const [row] = await db
    .select({ n: sql<number>`coalesce(sum(${cartItems.quantity}), 0)::int` })
    .from(cartItems)
    .where(eq(cartItems.cartId, cartId));
  return row?.n ?? 0;
}

/** Server Action helper: returns the cart id, creating the cart and cookie if needed. */
export async function ensureCart(userId: string | null) {
  const jar = await cookies();
  const existing = jar.get(CART_COOKIE)?.value;
  if (existing) {
    const found = await db.query.carts.findFirst({ where: eq(carts.id, existing), columns: { id: true, userId: true } });
    if (found) {
      if (userId && !found.userId) await db.update(carts).set({ userId }).where(eq(carts.id, found.id));
      return found.id;
    }
  }
  const [cart] = await db.insert(carts).values({ userId }).returning({ id: carts.id });
  jar.set(CART_COOKIE, cart.id, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 60,
  });
  return cart.id;
}

export async function addItem(cartId: string, productId: string, quantity: number) {
  const product = await db.query.products.findFirst({
    where: and(eq(products.id, productId), eq(products.status, "published")),
    columns: { id: true, stockQty: true, title: true },
  });
  if (!product) return { ok: false as const, message: "This piece is no longer available." };
  if (product.stockQty <= 0) return { ok: false as const, message: "Sorry, this piece has sold." };

  const existing = await db.query.cartItems.findFirst({
    where: and(eq(cartItems.cartId, cartId), eq(cartItems.productId, productId)),
  });
  const desired = Math.min(product.stockQty, (existing?.quantity ?? 0) + Math.max(1, quantity));
  if (existing) {
    await db.update(cartItems).set({ quantity: desired }).where(eq(cartItems.id, existing.id));
  } else {
    await db.insert(cartItems).values({ cartId, productId, quantity: desired });
  }
  await db.update(carts).set({ updatedAt: new Date() }).where(eq(carts.id, cartId));
  const capped = desired < (existing?.quantity ?? 0) + quantity;
  return {
    ok: true as const,
    message: capped ? `Added. Only ${product.stockQty} available.` : `${product.title} added to your cart.`,
  };
}

export async function setItemQuantity(cartId: string, itemId: string, quantity: number) {
  if (quantity <= 0) {
    await db.delete(cartItems).where(and(eq(cartItems.id, itemId), eq(cartItems.cartId, cartId)));
    return;
  }
  const item = await db.query.cartItems.findFirst({
    where: and(eq(cartItems.id, itemId), eq(cartItems.cartId, cartId)),
    with: { product: { columns: { stockQty: true } } },
  });
  if (!item) return;
  const capped = Math.min(quantity, Math.max(1, item.product.stockQty));
  await db.update(cartItems).set({ quantity: capped }).where(eq(cartItems.id, itemId));
}

export async function clearCart(cartId: string) {
  await db.delete(cartItems).where(eq(cartItems.cartId, cartId));
}
