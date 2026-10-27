"use server";

import { and, asc, eq, ne, sql } from "drizzle-orm";
import { updateTag } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { db } from "@/db";
import { productImages, products, type ProductStatus } from "@/db/schema";
import { saveUploadedImages } from "@/lib/admin-images";
import { audit } from "@/lib/audit";
import { TAGS } from "@/lib/catalog";
import { requireAdmin } from "@/lib/dal";
import { checkbox, formValues, zodErrors, type ActionState } from "@/lib/forms";
import { deleteImage } from "@/lib/storage";
import { parseMoneyToCents, slugify } from "@/lib/utils";

const schema = z.object({
  title: z.string().trim().min(2, "Title is required.").max(150),
  slug: z.string().trim().max(80),
  summary: z.string().trim().max(400).nullable(),
  description: z.string().max(20000).nullable(),
  priceCents: z.number({ error: "Enter a price." }).int().min(0, "Price can't be negative."),
  compareAtCents: z.number().int().min(0).nullable(),
  sku: z.string().trim().max(64).nullable(),
  stockQty: z.number({ error: "Enter the quantity in stock." }).int().min(0).max(100000),
  status: z.enum(["draft", "published", "archived"]),
  categoryId: z.string().nullable(),
  weightGrams: z.number().int().min(0).nullable(),
  sortOrder: z.number().int(),
});

async function uniqueSlug(base: string, excludeId?: string) {
  const root = slugify(base) || "product";
  for (let i = 0; i < 50; i++) {
    const candidate = i === 0 ? root : `${root}-${i + 1}`;
    const clash = await db.query.products.findFirst({
      where: excludeId ? and(eq(products.slug, candidate), ne(products.id, excludeId)) : eq(products.slug, candidate),
      columns: { id: true },
    });
    if (!clash) return candidate;
  }
  return `${root}-${crypto.randomUUID().slice(0, 6)}`;
}

function intOrNull(v: FormDataEntryValue | null) {
  const s = String(v ?? "").trim();
  if (s === "") return null;
  const n = Number.parseInt(s, 10);
  return Number.isFinite(n) ? n : null;
}

export async function saveProductAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const admin = await requireAdmin();
  const id = String(formData.get("id") ?? "") || null;
  const values = formValues(formData);
  const str = (k: string) => {
    const v = String(formData.get(k) ?? "").trim();
    return v === "" ? null : v;
  };
  const parsed = schema.safeParse({
    title: String(formData.get("title") ?? ""),
    slug: String(formData.get("slug") ?? ""),
    summary: str("summary"),
    description: str("description"),
    priceCents: parseMoneyToCents(formData.get("price")) ?? undefined,
    compareAtCents: parseMoneyToCents(formData.get("compareAt")),
    sku: str("sku"),
    stockQty: intOrNull(formData.get("stockQty")) ?? undefined,
    status: (String(formData.get("status") ?? "draft") as ProductStatus) || "draft",
    categoryId: str("categoryId"),
    weightGrams: intOrNull(formData.get("weightGrams")),
    sortOrder: intOrNull(formData.get("sortOrder")) ?? 0,
  });
  if (!parsed.success) {
    const errors = zodErrors(parsed.error);
    if (errors.priceCents) errors.price = errors.priceCents;
    return { ok: false, errors, values, message: "Please fix the highlighted fields." };
  }
  const data = parsed.data;
  const slug = await uniqueSlug(data.slug || data.title, id ?? undefined);
  const row = {
    ...data,
    slug,
    oneOfAKind: checkbox(formData, "oneOfAKind"),
    featured: checkbox(formData, "featured"),
  };

  let productId = id;
  if (id) {
    await db.update(products).set(row).where(eq(products.id, id));
    await audit(admin.id, "product.update", "product", id, { title: row.title, status: row.status, stockQty: row.stockQty });
  } else {
    const [created] = await db.insert(products).values(row).returning({ id: products.id });
    productId = created.id;
    await audit(admin.id, "product.create", "product", created.id, { title: row.title });
  }
  updateTag(TAGS.catalog);
  if (!id) redirect(`/admin/products/${productId}?created=1`);
  return { ok: true, message: "Product saved.", values: { ...values, slug } };
}

export async function deleteProductAction(formData: FormData) {
  const admin = await requireAdmin();
  const id = String(formData.get("id"));
  const images = await db.query.productImages.findMany({ where: eq(productImages.productId, id) });
  await db.delete(products).where(eq(products.id, id));
  for (const img of images) await deleteImage(img.url);
  await audit(admin.id, "product.delete", "product", id);
  updateTag(TAGS.catalog);
  redirect("/admin/products?deleted=1");
}

export async function uploadProductImagesAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  await requireAdmin();
  const productId = String(formData.get("ownerId"));
  try {
    const saved = await saveUploadedImages(formData, `products/${productId}`);
    const [{ max }] = await db
      .select({ max: sql<number>`coalesce(max(${productImages.sortOrder}), -1)::int` })
      .from(productImages)
      .where(eq(productImages.productId, productId));
    await db.insert(productImages).values(saved.map((s, i) => ({ productId, ...s, sortOrder: max + 1 + i })));
    updateTag(TAGS.catalog);
    return { ok: true, message: `${saved.length} image${saved.length === 1 ? "" : "s"} uploaded.` };
  } catch (err) {
    return { ok: false, message: err instanceof Error ? err.message : "Upload failed." };
  }
}

export async function updateProductImageAction(formData: FormData) {
  await requireAdmin();
  const id = String(formData.get("id"));
  const intent = String(formData.get("intent"));
  const image = await db.query.productImages.findFirst({ where: eq(productImages.id, id) });
  if (!image) return;

  if (intent === "delete") {
    await db.delete(productImages).where(eq(productImages.id, id));
    await deleteImage(image.url);
  } else if (intent === "alt") {
    await db.update(productImages).set({ alt: String(formData.get("alt") ?? "").trim() || null }).where(eq(productImages.id, id));
  } else if (intent === "up" || intent === "down" || intent === "first") {
    const siblings = await db.query.productImages.findMany({
      where: eq(productImages.productId, image.productId),
      orderBy: [asc(productImages.sortOrder), asc(productImages.createdAt)],
    });
    const order = siblings.map((s) => s.id);
    const from = order.indexOf(id);
    const to = intent === "first" ? 0 : intent === "up" ? Math.max(0, from - 1) : Math.min(order.length - 1, from + 1);
    order.splice(to, 0, ...order.splice(from, 1));
    await db.transaction(async (tx) => {
      for (const [i, imageId] of order.entries()) {
        await tx.update(productImages).set({ sortOrder: i }).where(eq(productImages.id, imageId));
      }
    });
  }
  updateTag(TAGS.catalog);
}
