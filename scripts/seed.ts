/**
 * Seeds a fresh database with the store's starting configuration. Safe to re-run: it only
 * inserts rows that don't exist yet and never overwrites edits made in the admin.
 *
 *   npm run db:seed
 */
import { sql } from "drizzle-orm";
import { connect, schema } from "./lib/db";

// Mirrors the live WooCommerce shipping zones.
const SHIPPING_RULES = [
  {
    name: "Free shipping",
    description: "USA and Canada: 3–7 business days.",
    countries: ["CA", "US"],
    rateCents: 0,
    sortOrder: 0,
  },
  {
    name: "International flat rate",
    description: "UK, Europe and Australia: 4–10 business days. Other countries: 10–20 business days.",
    countries: [],
    rateCents: 1500,
    sortOrder: 1,
  },
];

const PAGES = [
  {
    slug: "shipping-returns",
    title: "Shipping",
    metaDescription: "Shipping times and costs for Camille Allen dolls and sculptures.",
    showInNav: false,
    navOrder: 20,
    body: `Yes, we ship worldwide! All prices are in US dollars.

## Shipping arrival times

- USA / Canada: 3–7 business days
- UK / Europe / Australia / most countries: 4–10 business days
- India / Russia / Africa / South America: 10–20 business days

Questions or problems with an order? [Contact us](/contact) or call toll free (866) 993-6557.`,
  },
];

async function main() {
  const { db, pool } = connect();
  try {
    const [{ n: ruleCount }] = await db.select({ n: sql<number>`count(*)::int` }).from(schema.shippingRules);
    if (ruleCount === 0) {
      await db.insert(schema.shippingRules).values(SHIPPING_RULES);
      console.log(`Shipping rules: added ${SHIPPING_RULES.length}.`);
    } else {
      console.log(`Shipping rules: ${ruleCount} already exist, left unchanged.`);
    }

    const inserted = await db
      .insert(schema.pages)
      .values(PAGES)
      .onConflictDoNothing({ target: schema.pages.slug })
      .returning({ slug: schema.pages.slug });
    console.log(`Pages: added ${inserted.length}${inserted.length ? ` (${inserted.map((p) => p.slug).join(", ")})` : ""}.`);

    const adminEmails = (process.env.ADMIN_EMAILS ?? "")
      .split(",")
      .map((e) => e.trim().toLowerCase())
      .filter(Boolean);
    for (const email of adminEmails) {
      await db
        .insert(schema.users)
        .values({ email, role: "admin" })
        .onConflictDoUpdate({ target: schema.users.email, set: { role: "admin" } });
    }
    if (adminEmails.length) console.log(`Admins: ${adminEmails.join(", ")}.`);
    console.log("Seed complete.");
  } finally {
    await pool.end();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
