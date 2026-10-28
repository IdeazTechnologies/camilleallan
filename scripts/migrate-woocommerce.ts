/**
 * Imports the WooCommerce export in ./migration-data (see export-woocommerce.ts) into the new database.
 *
 *   npm run migrate:woocommerce -- --dry-run          # report only, writes nothing
 *   npm run migrate:woocommerce                       # products, customers, orders, pages, redirects
 *   npm run migrate:woocommerce -- --only=products,pages
 *
 * Re-runnable: rows that already exist (matched by WooCommerce id, email or slug) are skipped,
 * so nothing is duplicated and nothing edited in the new admin is overwritten.
 * Images are downloaded from the live site and stored in Vercel Blob (or the database).
 */
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { isNotNull, sql } from "drizzle-orm";
import type { Address, OrderStatus } from "../src/db/schema";
import { connect, schema, type ScriptDb } from "./lib/db";
import { decodeEntities, htmlToMarkdown, htmlToText } from "./lib/html-to-markdown";
import { createImageRehoster, type StoredImage } from "./lib/upload";

/* ---------------------------------- Types --------------------------------- */

type WooAddress = {
  first_name: string;
  last_name: string;
  company?: string;
  address_1: string;
  address_2: string;
  city: string;
  state: string;
  postcode: string;
  country: string;
  email?: string;
  phone?: string;
};
type WooMeta = { key: string; value: unknown };
type WooProduct = {
  id: number;
  name: string;
  slug: string;
  status: string;
  featured: boolean;
  description: string;
  short_description: string;
  sku: string;
  price: string;
  regular_price: string;
  sale_price: string;
  manage_stock: boolean;
  stock_quantity: number | null;
  stock_status: string;
  menu_order: number;
  date_created_gmt: string;
  date_modified_gmt: string;
  categories: { id: number; slug: string; name: string }[];
  images: { src: string; alt: string }[];
};
type WooCategory = { id: number; name: string; slug: string; parent: number; description: string; menu_order: number };
type WooCustomer = {
  id: number;
  email: string;
  first_name: string;
  last_name: string;
  date_created_gmt: string;
  billing: WooAddress;
  shipping: WooAddress;
};
type WooOrder = {
  id: number;
  number: string;
  status: string;
  date_created_gmt: string;
  date_modified_gmt: string;
  date_paid_gmt: string | null;
  date_completed_gmt: string | null;
  customer_id: number;
  customer_note: string;
  billing: WooAddress;
  shipping: WooAddress;
  payment_method: string;
  payment_method_title: string;
  transaction_id: string;
  shipping_total: string;
  total_tax: string;
  total: string;
  meta_data: WooMeta[];
  line_items: { name: string; product_id: number; quantity: number; total: string; sku: string }[];
  shipping_lines: { method_title: string }[];
  coupon_lines: { code: string; discount: string }[];
  refunds: { reason: string; total: string }[];
};
type WpPage = { slug: string; content: { rendered: string } };

/* --------------------------------- Options -------------------------------- */

const argv = process.argv.slice(2);
const dryRun = argv.includes("--dry-run");
const ALL_STEPS = ["products", "customers", "orders", "pages", "redirects"] as const;
const onlyArg = argv.find((a) => a.startsWith("--only="))?.slice("--only=".length);
const steps = new Set(onlyArg ? onlyArg.split(",").map((s) => s.trim()) : ALL_STEPS);
const DATA_DIR = path.resolve("migration-data");
const OLD_HOST = /^https?:\/\/(?:www\.)?camilleallen\.com/i;

// Leftover test product on the live store.
const SKIP_PRODUCT_SLUGS = new Set(["test"]);

const PAGE_IMPORTS = [
  {
    wpSlug: "about-v2",
    slug: "artist",
    title: "Artist",
    metaDescription: "Camille Allen is a Vancouver-born artist known for her realistic miniature newborn baby sculptures.",
    showInNav: true,
    navOrder: 0,
    dropFirstHeading: true,
  },
  {
    wpSlug: "press-2",
    slug: "press",
    title: "In The News",
    navLabel: "Press",
    metaDescription: "Camille Allen's baby sculptures in the news, magazines and on television.",
    showInNav: true,
    navOrder: 10,
    dropFirstHeading: false,
  },
];

// Old WordPress pages that were demo content or are replaced by built-in routes.
const STATIC_REDIRECTS: Record<string, string> = {
  "/about": "/artist",
  "/about-v1": "/artist",
  "/about-v2": "/artist",
  "/about-v3": "/artist",
  "/press-2": "/press",
  "/for-sale": "/shop",
  "/interactive": "/",
  "/faqs": "/faq",
  "/order-tracking": "/account",
  "/blog": "/",
  "/my-instagram-feed": "/",
  "/sample-page": "/",
  "/elements/toggles-faqs": "/faq",
  "/elements/:path*": "/",
  "/home/:path*": "/",
};

const ORDER_STATUS: Record<string, OrderStatus> = {
  completed: "shipped",
  processing: "paid",
  "on-hold": "pending",
  // Woo "pending payment" orders were abandoned checkouts.
  pending: "cancelled",
  cancelled: "cancelled",
  failed: "failed",
  refunded: "refunded",
};

const PAYMENT_LABELS: Record<string, string> = {
  psigate: "psigate",
  paypal: "PayPal",
  offline_cc: "Credit card (manual)",
};

/* --------------------------------- Helpers -------------------------------- */

async function load<T>(name: string): Promise<T> {
  return JSON.parse(await readFile(path.join(DATA_DIR, `${name}.json`), "utf8")) as T;
}

const toCents = (value: string | number | null | undefined) => Math.round(Number(value || 0) * 100);
const toDate = (value: string | null | undefined) => (value ? new Date(value.endsWith("Z") ? value : `${value}Z`) : null);
const normalizeEmail = (value: string | null | undefined) => (value ?? "").trim().toLowerCase();
const meta = (o: { meta_data: WooMeta[] }, key: string) => {
  const v = o.meta_data.find((m) => m.key === key)?.value;
  return typeof v === "string" || typeof v === "number" ? String(v) : null;
};

function toAddress(a: WooAddress, fallbackName = ""): Address | null {
  if (!a?.address_1?.trim()) return null;
  return {
    name: `${a.first_name ?? ""} ${a.last_name ?? ""}`.trim() || fallbackName,
    line1: a.address_1.trim(),
    line2: a.address_2?.trim() || null,
    city: a.city?.trim() ?? "",
    region: a.state?.trim() ?? "",
    postalCode: a.postcode?.trim() ?? "",
    country: a.country?.trim().toUpperCase() || "US",
    phone: a.phone?.trim() || null,
  };
}

function relativeIfOld(url: string) {
  if (!OLD_HOST.test(url)) return url;
  const rest = url.replace(OLD_HOST, "") || "/";
  const pathOnly = rest.replace(/\/+$/, "") || "/";
  if (STATIC_REDIRECTS[pathOnly]) return STATIC_REDIRECTS[pathOnly];
  for (const [source, destination] of Object.entries(STATIC_REDIRECTS)) {
    const prefix = source.endsWith("/:path*") ? source.slice(0, -"/:path*".length) : null;
    if (prefix && (pathOnly === prefix || pathOnly.startsWith(`${prefix}/`))) return destination;
  }
  return pathOnly;
}

function imageSources(html: string) {
  return [...html.matchAll(/<img\b[^>]*\ssrc\s*=\s*["']([^"']+)["']/gi)].map((m) => decodeEntities(m[1]));
}

const report: string[] = [];
const warnings: string[] = [];
const log = (line: string) => {
  report.push(line);
  console.log(line);
};
const warn = (line: string) => {
  warnings.push(line);
  console.warn(`  ! ${line}`);
};

/* -------------------------------- Products -------------------------------- */

async function migrateProducts(db: ScriptDb, rehost: ReturnType<typeof createImageRehoster>, renamed: Map<string, string>) {
  const [wooProducts, wooCategories] = await Promise.all([load<WooProduct[]>("products"), load<WooCategory[]>("categories")]);
  const categoryById = new Map(wooCategories.map((c) => [c.id, c]));

  const existingProducts = await db.select({ wooId: schema.products.wooId, slug: schema.products.slug }).from(schema.products);
  const importedIds = new Set(existingProducts.map((p) => p.wooId).filter((id): id is number => id !== null));
  const takenSlugs = new Set(existingProducts.map((p) => p.slug));

  const pickCategory = (p: WooProduct) => {
    const cats = p.categories.map((c) => categoryById.get(c.id)).filter((c): c is WooCategory => !!c && c.slug !== "uncategorized");
    // Categories are flat in the new store, so keep the most specific one.
    return cats.find((c) => c.parent !== 0) ?? cats[0] ?? null;
  };

  const toImport = wooProducts.filter((p) => !SKIP_PRODUCT_SLUGS.has(p.slug) && !importedIds.has(p.id));

  // Categories: only the ones used by imported products.
  const neededCategories = new Map<string, WooCategory>();
  for (const p of toImport) {
    const c = pickCategory(p);
    if (c) neededCategories.set(c.slug, c);
  }
  const existingCategories = await db.select({ id: schema.categories.id, slug: schema.categories.slug }).from(schema.categories);
  const categoryIdBySlug = new Map(existingCategories.map((c) => [c.slug, c.id]));
  let categoriesAdded = 0;
  for (const c of neededCategories.values()) {
    if (categoryIdBySlug.has(c.slug)) continue;
    categoriesAdded++;
    if (dryRun) {
      categoryIdBySlug.set(c.slug, `dry-${c.slug}`);
      continue;
    }
    const [row] = await db
      .insert(schema.categories)
      .values({
        name: decodeEntities(c.name),
        slug: c.slug,
        description: c.description ? htmlToText(c.description) : null,
        sortOrder: c.menu_order,
        wooId: c.id,
      })
      .returning({ id: schema.categories.id });
    categoryIdBySlug.set(c.slug, row.id);
  }

  let added = 0;
  let images = 0;
  for (const p of toImport) {
    let slug = p.slug;
    if (takenSlugs.has(slug)) {
      slug = `${p.slug}-${p.id}`;
      renamed.set(p.slug, slug);
      warn(`Product slug "${p.slug}" is taken; imported as "${slug}".`);
    }
    takenSlugs.add(slug);

    const title = decodeEntities(p.name).trim();
    const regular = toCents(p.regular_price || p.price);
    const sale = p.sale_price ? toCents(p.sale_price) : null;
    const tagline = p.short_description.match(/<(i|em)\b[^>]*>([\s\S]*?)<\/\1>/i)?.[2];
    const summary = tagline ? htmlToText(tagline) : null;
    const category = pickCategory(p);
    const stockQty = p.manage_stock ? Math.max(0, p.stock_quantity ?? 0) : p.stock_status === "instock" ? 1 : 0;

    const values = {
      slug,
      title,
      summary: summary && summary.length > 3 && summary !== title ? summary : null,
      description: htmlToMarkdown(p.description || p.short_description, { rewriteUrl: (u, kind) => (kind === "link" ? relativeIfOld(u) : u) }) || null,
      priceCents: sale !== null && sale < regular ? sale : regular,
      compareAtCents: sale !== null && sale < regular ? regular : null,
      sku: p.sku || null,
      stockQty,
      oneOfAKind: p.categories.some((c) => c.slug === "one-of-a-kind-babies"),
      status: p.status === "publish" ? ("published" as const) : p.status === "private" ? ("archived" as const) : ("draft" as const),
      featured: p.featured,
      categoryId: category ? (categoryIdBySlug.get(category.slug) ?? null) : null,
      sortOrder: p.menu_order,
      wooId: p.id,
      createdAt: toDate(p.date_created_gmt) ?? new Date(),
      updatedAt: toDate(p.date_modified_gmt) ?? new Date(),
    };

    added++;
    images += p.images.length;
    if (dryRun) continue;

    const stored: Array<StoredImage & { alt: string; sortOrder: number }> = [];
    for (const [i, img] of p.images.entries()) {
      try {
        stored.push({ ...(await rehost(img.src, "products")), alt: img.alt?.trim() || title, sortOrder: i });
      } catch (err) {
        warn(`${title}: image ${img.src} failed (${err instanceof Error ? err.message : err})`);
      }
    }
    await db.transaction(async (tx) => {
      const [row] = await tx.insert(schema.products).values(values).returning({ id: schema.products.id });
      if (stored.length) await tx.insert(schema.productImages).values(stored.map((s) => ({ ...s, productId: row.id })));
    });
    console.log(`  product: ${title} (${stored.length} images)`);
  }
  log(
    `Products: ${added} ${dryRun ? "to import" : "imported"}, ${wooProducts.length - toImport.length} skipped (already imported or test), ${images} images, ${categoriesAdded} new categories.`,
  );
}

/* -------------------------------- Customers ------------------------------- */

async function migrateCustomers(db: ScriptDb) {
  const customers = await load<WooCustomer[]>("customers");
  const existing = new Set((await db.select({ email: schema.users.email }).from(schema.users)).map((u) => u.email));
  let added = 0;
  let addresses = 0;
  for (const c of customers) {
    const email = normalizeEmail(c.email);
    if (!email || existing.has(email)) continue;
    existing.add(email);
    const name = `${c.first_name} ${c.last_name}`.trim() || `${c.billing.first_name} ${c.billing.last_name}`.trim() || null;
    const address = toAddress(c.shipping, name ?? "") ?? toAddress(c.billing, name ?? "");
    added++;
    if (address) addresses++;
    if (dryRun) continue;
    await db.transaction(async (tx) => {
      const [user] = await tx
        .insert(schema.users)
        .values({ email, name, phone: c.billing.phone?.trim() || null, role: "customer", createdAt: toDate(c.date_created_gmt) ?? new Date() })
        .returning({ id: schema.users.id });
      if (address) {
        const { phone, ...rest } = address;
        await tx.insert(schema.addresses).values({ ...rest, phone: phone || c.billing.phone?.trim() || null, userId: user.id, isDefault: true });
      }
    });
  }
  log(`Customers: ${added} ${dryRun ? "to import" : "imported"} (${addresses} with an address), ${customers.length - added} already present.`);
}

/* --------------------------------- Orders --------------------------------- */

async function migrateOrders(db: ScriptDb) {
  const [wooOrders, customers] = await Promise.all([load<WooOrder[]>("orders"), load<WooCustomer[]>("customers")]);
  const customerEmail = new Map(customers.map((c) => [c.id, normalizeEmail(c.email)]));

  const productRows = await db
    .select({
      id: schema.products.id,
      wooId: schema.products.wooId,
      imageUrl: sql<string | null>`(select url from product_images where product_id = ${schema.products.id} order by sort_order limit 1)`,
    })
    .from(schema.products)
    .where(isNotNull(schema.products.wooId));
  const productByWoo = new Map(productRows.map((p) => [p.wooId!, p]));
  const userByEmail = new Map((await db.select({ id: schema.users.id, email: schema.users.email }).from(schema.users)).map((u) => [u.email, u.id]));
  const existingOrders = await db
    .select({ wooId: schema.orders.wooId, number: schema.orders.number, psigateOrderId: schema.orders.psigateOrderId })
    .from(schema.orders);
  const importedIds = new Set(existingOrders.map((o) => o.wooId));
  const takenNumbers = new Set(existingOrders.map((o) => o.number));
  const takenPsigateIds = new Set(existingOrders.map((o) => o.psigateOrderId).filter(Boolean));

  let added = 0;
  let linked = 0;
  const byStatus: Record<string, number> = {};
  // Oldest first so order numbers and history read naturally.
  for (const o of [...wooOrders].reverse()) {
    if (importedIds.has(o.id)) continue;
    const status = ORDER_STATUS[o.status];
    if (!status) {
      warn(`Order #${o.number}: unknown status "${o.status}", skipped.`);
      continue;
    }
    const email = normalizeEmail(o.billing.email) || customerEmail.get(o.customer_id) || `order-${o.number}@unknown.invalid`;
    const userId = userByEmail.get(email) ?? (o.customer_id ? userByEmail.get(customerEmail.get(o.customer_id) ?? "") : undefined) ?? null;
    if (userId) linked++;

    const shippingCents = toCents(o.shipping_total);
    const taxCents = toCents(o.total_tax);
    const totalCents = toCents(o.total);
    const number = Number(o.number);
    let psigateOrderId = meta(o, "_psigate_order_id");
    if (psigateOrderId && takenPsigateIds.has(psigateOrderId)) psigateOrderId = null;
    if (psigateOrderId) takenPsigateIds.add(psigateOrderId);
    const last4 = meta(o, "Credit Card Numbers Right");
    const completedAt = toDate(o.date_completed_gmt);

    const items = o.line_items
      .filter((l) => l.quantity > 0)
      .map((l) => {
        const product = productByWoo.get(l.product_id);
        return {
          productId: product?.id ?? null,
          title: decodeEntities(l.name),
          sku: l.sku || null,
          imageUrl: product?.imageUrl ?? null,
          unitPriceCents: Math.round(toCents(l.total) / l.quantity),
          quantity: l.quantity,
        };
      });

    const notes = [`Imported from WooCommerce order #${o.number} (status "${o.status}", paid by ${o.payment_method_title || o.payment_method || "unknown"}).`];
    for (const c of o.coupon_lines) notes.push(`Coupon ${c.code.toUpperCase()} applied: −$${Number(c.discount).toFixed(2)}.`);
    for (const r of o.refunds) notes.push(`Refunded $${Math.abs(Number(r.total)).toFixed(2)}${r.reason ? `: ${r.reason}` : ""}.`);

    added++;
    byStatus[status] = (byStatus[status] ?? 0) + 1;
    if (dryRun) continue;

    const useNumber = Number.isInteger(number) && number > 0 && !takenNumbers.has(number);
    if (useNumber) takenNumbers.add(number);
    else warn(`Order #${o.number}: number already used, a new number will be assigned.`);

    await db.transaction(async (tx) => {
      const [row] = await tx
        .insert(schema.orders)
        .values({
          ...(useNumber ? { number } : {}),
          userId,
          email,
          status,
          currency: "USD",
          subtotalCents: totalCents - shippingCents - taxCents,
          shippingCents,
          taxCents,
          totalCents,
          shippingMethod: o.shipping_lines.map((s) => s.method_title).join(", ") || null,
          shippingAddress: toAddress(o.shipping) ?? toAddress(o.billing),
          billingAddress: toAddress(o.billing),
          customerNote: o.customer_note?.trim() || null,
          paymentMethod: PAYMENT_LABELS[o.payment_method] ?? (o.payment_method_title || o.payment_method || "unknown"),
          psigateOrderId,
          psigateTransRef: o.transaction_id || null,
          cardLast4: last4 && /^\d{4}$/.test(last4) ? last4 : null,
          paidAt: toDate(o.date_paid_gmt),
          fulfilledAt: status === "shipped" ? completedAt : null,
          shippedAt: status === "shipped" ? completedAt : null,
          cancelledAt: status === "cancelled" ? toDate(o.date_modified_gmt) : null,
          wooId: o.id,
          createdAt: toDate(o.date_created_gmt) ?? new Date(),
          updatedAt: toDate(o.date_modified_gmt) ?? new Date(),
        })
        .returning({ id: schema.orders.id });
      if (items.length) await tx.insert(schema.orderItems).values(items.map((i) => ({ ...i, orderId: row.id })));
      await tx.insert(schema.orderEvents).values(
        notes.map((message) => ({ orderId: row.id, type: "note" as const, message, createdAt: toDate(o.date_created_gmt) ?? new Date() })),
      );
    });
  }

  if (!dryRun && added) {
    await db.execute(sql`select setval(pg_get_serial_sequence('orders', 'number'), greatest((select max(number) from orders), 1))`);
  }
  const summary = Object.entries(byStatus)
    .map(([s, n]) => `${n} ${s}`)
    .join(", ");
  log(`Orders: ${added} ${dryRun ? "to import" : "imported"} (${summary || "none"}), ${linked} linked to customer accounts, ${wooOrders.length - added} skipped.`);
}

/* ---------------------------------- Pages --------------------------------- */

async function migratePages(db: ScriptDb, rehost: ReturnType<typeof createImageRehoster>) {
  const wpPages = await load<WpPage[]>("pages");
  const existing = new Set((await db.select({ slug: schema.pages.slug }).from(schema.pages)).map((p) => p.slug));
  let added = 0;
  for (const spec of PAGE_IMPORTS) {
    const source = wpPages.find((p) => p.slug === spec.wpSlug);
    if (!source) {
      warn(`Page "${spec.wpSlug}" not found in the export.`);
      continue;
    }
    if (existing.has(spec.slug)) continue;
    const html = source.content.rendered;
    const sources = imageSources(html).filter((src) => OLD_HOST.test(src));
    added++;
    if (dryRun) {
      console.log(`  page: /${spec.slug} (${sources.length} images to re-host)`);
      continue;
    }
    const rehosted = new Map<string, string>();
    for (const src of sources) {
      try {
        rehosted.set(src, (await rehost(src, "pages")).url);
      } catch (err) {
        warn(`/${spec.slug}: image ${src} failed (${err instanceof Error ? err.message : err})`);
      }
    }
    const body = htmlToMarkdown(html, {
      dropFirstHeading: spec.dropFirstHeading,
      rewriteUrl: (url, kind) => (kind === "image" ? (rehosted.get(url) ?? url) : relativeIfOld(url)),
    });
    await db.insert(schema.pages).values({
      slug: spec.slug,
      title: spec.title,
      body,
      metaDescription: spec.metaDescription,
      published: true,
      showInNav: spec.showInNav,
      navLabel: "navLabel" in spec ? spec.navLabel : null,
      navOrder: spec.navOrder,
    });
    console.log(`  page: /${spec.slug} (${rehosted.size} images)`);
  }
  log(`Pages: ${added} ${dryRun ? "to import" : "imported"} of ${PAGE_IMPORTS.length}.`);
}

/* -------------------------------- Redirects ------------------------------- */

async function writeRedirects(renamed: Map<string, string>) {
  const categories = await load<WooCategory[]>("categories");
  const products = await load<WooProduct[]>("products");
  const usedCategorySlugs = new Set(products.flatMap((p) => p.categories.map((c) => c.slug)));
  const redirects: { source: string; destination: string }[] = [];
  for (const [source, destination] of Object.entries(STATIC_REDIRECTS)) redirects.push({ source, destination });
  for (const [from, to] of renamed) redirects.push({ source: `/product/${from}`, destination: `/product/${to}` });
  for (const c of categories) {
    if (usedCategorySlugs.has(c.slug) && c.slug !== "uncategorized") continue;
    redirects.push({ source: `/product-category/${c.slug}`, destination: "/shop" });
  }
  const file = path.resolve("src/data/legacy-redirects.json");
  if (!dryRun) await writeFile(file, `${JSON.stringify(redirects, null, 2)}\n`);
  log(`Redirects: ${redirects.length} ${dryRun ? "would be written" : "written"} to src/data/legacy-redirects.json.`);
}

/* ---------------------------------- Main ---------------------------------- */

async function main() {
  const { db, pool } = connect();
  const rehost = createImageRehoster(db);
  const renamed = new Map<string, string>();
  console.log(`${dryRun ? "DRY RUN: nothing will be written. " : ""}Steps: ${[...steps].join(", ")}`);
  console.log(`Images will be stored in ${process.env.BLOB_READ_WRITE_TOKEN ? "Vercel Blob" : "the database (media table)"}.\n`);
  try {
    if (steps.has("products")) await migrateProducts(db, rehost, renamed);
    if (steps.has("customers")) await migrateCustomers(db);
    if (steps.has("orders")) await migrateOrders(db);
    if (steps.has("pages")) await migratePages(db, rehost);
    if (steps.has("redirects")) await writeRedirects(renamed);
  } finally {
    await pool.end();
  }
  console.log(`\n=== Summary${dryRun ? " (dry run)" : ""} ===\n${report.join("\n")}`);
  if (warnings.length) console.log(`\n${warnings.length} warning(s):\n${warnings.map((w) => `- ${w}`).join("\n")}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
