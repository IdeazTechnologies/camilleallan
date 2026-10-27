/**
 * Exports the live WooCommerce store to ./migration-data as JSON using the WordPress REST API.
 *
 *   WP_URL=https://camilleallen.com WP_USER=... WP_PASSWORD=... npm run export:woocommerce
 *
 * Read-only: signs in with a normal wp-admin account (cookie + REST nonce) and only issues GET requests.
 * The output contains customer personal data; it is git-ignored and should be deleted after migrating.
 */
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

const base = (process.env.WP_URL ?? "https://camilleallen.com").replace(/\/$/, "");
const user = process.env.WP_USER;
const password = process.env.WP_PASSWORD;
const outDir = path.resolve("migration-data");
const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) CamilleAllenMigration/1.0";

const jar = new Map<string, string>();

function storeCookies(res: Response) {
  for (const raw of res.headers.getSetCookie()) {
    const [pair] = raw.split(";");
    const eq = pair.indexOf("=");
    const name = pair.slice(0, eq).trim();
    const value = pair.slice(eq + 1).trim();
    if (value === "deleted" || value === "") jar.delete(name);
    else jar.set(name, value);
  }
}

function cookieHeader() {
  return [...jar.entries()].map(([k, v]) => `${k}=${v}`).join("; ");
}

async function request(url: string, init: RequestInit = {}) {
  const res = await fetch(url, {
    ...init,
    redirect: "manual",
    headers: { "User-Agent": UA, Cookie: cookieHeader(), ...(init.headers ?? {}) },
  });
  storeCookies(res);
  return res;
}

async function login() {
  if (!user || !password) throw new Error("Set WP_USER and WP_PASSWORD");
  jar.set("wordpress_test_cookie", "WP%20Cookie%20check");
  await request(`${base}/wp-login.php`);
  const res = await request(`${base}/wp-login.php`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      log: user,
      pwd: password,
      "wp-submit": "Log In",
      redirect_to: `${base}/wp-admin/`,
      testcookie: "1",
    }),
  });
  const loggedIn = [...jar.keys()].some((k) => k.startsWith("wordpress_logged_in"));
  if (!loggedIn) {
    const text = await res.text();
    const error = text.match(/id="login_error"[\s\S]{0,500}?<\/div>/)?.[0]?.replace(/<[^>]+>/g, " ").trim();
    throw new Error(`Login failed (HTTP ${res.status}). ${error ?? "No error message; a 2FA or captcha step may be required."}`);
  }
  const nonceRes = await request(`${base}/wp-admin/admin-ajax.php?action=rest-nonce`);
  const nonce = (await nonceRes.text()).trim();
  if (!/^[a-f0-9]{6,}$/i.test(nonce)) throw new Error(`Could not get a REST nonce (got "${nonce.slice(0, 40)}")`);
  return nonce;
}

async function getAll(nonce: string, route: string, params: Record<string, string> = {}) {
  const items: unknown[] = [];
  for (let page = 1; page < 200; page++) {
    const qs = new URLSearchParams({ per_page: "100", page: String(page), ...params });
    const res = await request(`${base}/wp-json/${route}?${qs}`, { headers: { "X-WP-Nonce": nonce } });
    if (res.status === 400 && page > 1) break;
    if (!res.ok) throw new Error(`${route} page ${page}: HTTP ${res.status} ${(await res.text()).slice(0, 200)}`);
    const batch = (await res.json()) as unknown[];
    items.push(...batch);
    const totalPages = Number(res.headers.get("x-wp-totalpages") ?? "1");
    if (page >= totalPages || batch.length === 0) break;
  }
  return items;
}

async function getOne(nonce: string, route: string) {
  const res = await request(`${base}/wp-json/${route}`, { headers: { "X-WP-Nonce": nonce } });
  if (!res.ok) throw new Error(`${route}: HTTP ${res.status}`);
  return res.json();
}

async function save(name: string, data: unknown) {
  await writeFile(path.join(outDir, `${name}.json`), JSON.stringify(data, null, 2));
  const count = Array.isArray(data) ? `${data.length} records` : "saved";
  console.log(`  ${name}.json: ${count}`);
}

async function tryStep(label: string, fn: () => Promise<void>) {
  try {
    await fn();
  } catch (err) {
    console.warn(`  ${label}: skipped (${err instanceof Error ? err.message : err})`);
  }
}

async function main() {
  await mkdir(outDir, { recursive: true });
  console.log(`Signing in to ${base} ...`);
  const nonce = await login();
  console.log("Signed in. Exporting:");

  await save("products", await getAll(nonce, "wc/v3/products", { status: "any" }));
  await tryStep("variations", async () => {
    // Variable products are rare here, but keep their variations if present.
    const products = (await getAll(nonce, "wc/v3/products", { status: "any", type: "variable" })) as { id: number }[];
    const variations: Record<string, unknown[]> = {};
    for (const p of products) variations[p.id] = await getAll(nonce, `wc/v3/products/${p.id}/variations`);
    await save("variations", variations);
  });
  await save("categories", await getAll(nonce, "wc/v3/products/categories"));
  await save("orders", await getAll(nonce, "wc/v3/orders", { status: "any" }));
  await save("customers", await getAll(nonce, "wc/v3/customers", { role: "all" }));
  await tryStep("pages", async () => save("pages", await getAll(nonce, "wp/v2/pages", { context: "edit", status: "publish,draft,private" })));
  await tryStep("media", async () => save("media", await getAll(nonce, "wp/v2/media", { media_type: "image" })));
  await tryStep("settings", async () => save("settings-general", await getOne(nonce, "wc/v3/settings/general")));
  await tryStep("taxes", async () => save("taxes", await getAll(nonce, "wc/v3/taxes")));
  await tryStep("shipping", async () => {
    const zones = (await getOne(nonce, "wc/v3/shipping/zones")) as { id: number; name: string }[];
    const full = [];
    for (const zone of zones) {
      full.push({
        ...zone,
        locations: await getOne(nonce, `wc/v3/shipping/zones/${zone.id}/locations`),
        methods: await getOne(nonce, `wc/v3/shipping/zones/${zone.id}/methods`),
      });
    }
    await save("shipping-zones", full);
  });
  console.log(`Done. Files are in ${outDir}`);
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
