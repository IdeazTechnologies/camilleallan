import { config } from "dotenv";
import { expect, test } from "@playwright/test";
import { Pool } from "pg";

config({ path: ".env.local", quiet: true });

const run = Date.now().toString(36);
const productSlug = `e2e-doll-${run}`;
const buyerEmail = `e2e-buyer-${run}@example.com`;
const adminEmail = `e2e-admin-${run}@example.com`;
const PRICE_CENTS = 4200;

let pool: Pool;
let productId: string;

test.beforeAll(async () => {
  pool = new Pool({ connectionString: process.env.DATABASE_URL_UNPOOLED ?? process.env.DATABASE_URL, max: 2 });
  productId = crypto.randomUUID();
  await pool.query(
    `insert into products (id, slug, title, summary, price_cents, stock_qty, one_of_a_kind, status)
     values ($1, $2, 'E2E Test Doll', 'Created by the end-to-end test', $3, 3, false, 'published')`,
    [productId, productSlug, PRICE_CENTS],
  );
  await pool.query(`insert into users (id, email, role) values ($1, $2, 'admin')`, [crypto.randomUUID(), adminEmail]);
});

test.afterAll(async () => {
  if (!pool) return;
  const emails = [buyerEmail, adminEmail];
  await pool.query(
    `delete from payment_simulations where psigate_order_id in (select psigate_order_id from orders where email = $1)`,
    [buyerEmail],
  );
  await pool.query(`delete from orders where email = $1`, [buyerEmail]);
  await pool.query(`delete from newsletter_subscribers where email = $1`, [buyerEmail]);
  await pool.query(`delete from products where id = $1`, [productId]);
  await pool.query(`delete from carts c where not exists (select 1 from cart_items i where i.cart_id = c.id) and c.created_at > now() - interval '1 hour' and c.user_id is null`);
  await pool.query(`delete from verification_tokens where identifier = any($1)`, [emails]);
  await pool.query(`delete from email_log where "to" = any($1)`, [emails]);
  await pool.query(`delete from users where email = any($1)`, [emails]);
  await pool.end();
});

async function latestLoginCode(email: string) {
  for (let i = 0; i < 30; i++) {
    const { rows } = await pool.query(`select text from email_log where "to" = $1 order by created_at desc limit 1`, [email]);
    const code = (rows[0]?.text as string | undefined)?.match(/\b(\d{6})\b/)?.[1];
    if (code) return code;
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error(`No sign-in email for ${email}`);
}

test("customer buys a piece and the admin ships it", async ({ page, browser }) => {
  // Browse and add to cart.
  await page.goto(`/product/${productSlug}`);
  await expect(page.getByRole("heading", { name: "E2E Test Doll" })).toBeVisible();
  await page.getByRole("button", { name: "Add to cart" }).click();
  await expect(page.getByRole("link", { name: /View cart/ })).toBeVisible();

  await page.goto("/cart");
  await expect(page.getByRole("link", { name: "E2E Test Doll" }).first()).toBeVisible();
  await page.getByRole("link", { name: "Checkout", exact: true }).click();

  // Checkout as a guest.
  await expect(page).toHaveURL(/\/checkout$/);
  await page.getByLabel("Email", { exact: true }).fill(buyerEmail);
  await page.getByLabel("Full name").fill("Test Buyer");
  await page.getByLabel("Country").selectOption("US");
  await page.getByLabel("Street address").fill("1 Test Street");
  await page.getByLabel("City").fill("Seattle");
  await page.getByLabel("State / Province").fill("WA");
  await page.getByLabel("ZIP / Postal code").fill("98101");
  await expect(page.getByRole("radio", { name: /Free shipping/ })).toBeChecked();

  // PSIGATE_MODE=simulate: this test card is approved without contacting PSiGate.
  await page.getByLabel("Card number").fill("4111 1111 1111 1111");
  await page.getByLabel("Expiry (MM/YY)").fill("12/30");
  await page.getByLabel("Security code (CVV)").fill("123");
  await page.getByRole("button", { name: "Pay $42.00" }).click();

  await expect(page.getByRole("heading", { name: "Thank you for your order!" })).toBeVisible();
  const { rows: orders } = await pool.query(`select id, number, status, total_cents from orders where email = $1`, [buyerEmail]);
  expect(orders).toHaveLength(1);
  expect(orders[0]).toMatchObject({ status: "paid", total_cents: PRICE_CENTS });
  await expect(page.getByText(`Order #${orders[0].number}`).first()).toBeVisible();
  const { rows: stock } = await pool.query(`select stock_qty from products where id = $1`, [productId]);
  expect(stock[0].stock_qty).toBe(2);
  const { rows: receipts } = await pool.query(`select subject from email_log where "to" = $1`, [buyerEmail]);
  expect(receipts.length).toBeGreaterThan(0);

  // Admin signs in with an emailed code and ships the order.
  const admin = await (await browser.newContext()).newPage();
  await admin.goto(`/login?next=/admin/orders/${orders[0].id}`);
  await admin.getByRole("main").getByLabel("Email address").fill(adminEmail);
  // Forms reject submissions made within 2 seconds of loading (bot protection).
  await admin.waitForTimeout(2_500);
  await admin.getByRole("button", { name: "Email me a sign-in code" }).click();
  await expect(admin.getByLabel("6-digit code")).toBeVisible();
  await admin.getByLabel("6-digit code").fill(await latestLoginCode(adminEmail));
  await admin.getByRole("button", { name: "Sign in" }).click();

  await expect(admin).toHaveURL(new RegExp(`/admin/orders/${orders[0].id}`));
  await admin.getByLabel("Change status to").selectOption("shipped");
  await admin.getByPlaceholder("Carrier (e.g. Canada Post)").fill("Canada Post");
  await admin.getByPlaceholder("Tracking number").fill("E2E123456");
  await admin.getByRole("button", { name: "Update order" }).click();

  await expect
    .poll(async () => (await pool.query(`select status from orders where id = $1`, [orders[0].id])).rows[0].status)
    .toBe("shipped");
  const { rows: shipments } = await pool.query(`select carrier, tracking_number from shipments where order_id = $1`, [orders[0].id]);
  expect(shipments[0]).toMatchObject({ carrier: "Canada Post", tracking_number: "E2E123456" });
});
