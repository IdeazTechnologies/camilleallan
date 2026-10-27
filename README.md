# Camille Allen — camilleallen.com

Online shop and portfolio for Camille Allen's dolls and baby sculptures. It replaces the old WordPress/WooCommerce
site with a Next.js app on Vercel, backed by Neon Postgres.

## What's included

- **Storefront**: shop and category pages, product pages with an image gallery and lightbox, gallery albums,
  editable pages (About, Press, Shipping), and an Instagram feed.
- **Cart and checkout**: guest or signed-in checkout, stock reserved for 30 minutes, prices recalculated on the server,
  and flat-rate shipping rules by country, subtotal and item count.
- **Payments**: PSiGate's hosted payment page, so card numbers never reach this app. Every payment is confirmed
  server-to-server with PSiGate's Order Verification API, and saved cards can be enabled once PSiGate allows it.
- **Accounts**: passwordless sign-in with an emailed 6-digit code or link, plus order history, addresses, saved cards
  and newsletter preferences.
- **Admin** (`/admin`): products and images, categories, orders (status, tracking, packing slips, notes),
  customers, gallery, shipping rules, banners, pages, polls, contact messages, newsletter campaigns, email log and
  store settings.
- **Email**: sent through the Ideaz API, or kept in the `email_log` table only when `EMAIL_TRANSPORT=outbox`.

## Stack

Next.js 16 (App Router, Cache Components, Partial Prefetching), React 19, TypeScript, Drizzle ORM, Neon Postgres,
Auth.js v5 (database sessions), Vercel Blob for images, React Email, Vitest and Playwright.

## Local setup

```bash
npm install
cp .env.example .env.local   # then fill in DATABASE_URL, AUTH_SECRET, etc.
npm run db:migrate           # create tables
npm run db:seed              # shipping rules, starter pages, admins from ADMIN_EMAILS
npm run dev
```

For local development, set `PSIGATE_MODE=simulate` and `EMAIL_TRANSPORT=outbox`. Checkout then uses a built-in fake
payment page. Sign-in codes are printed in the terminal and can also be read in Admin > Emails.

To make someone an admin, add their email to `ADMIN_EMAILS` (they're promoted on their next sign-in) or run
`npm run make-admin -- person@example.com`.

## Scripts

| Command | Purpose |
| --- | --- |
| `npm run dev` / `build` / `start` | Next.js |
| `npm run db:generate` | Generate a migration after editing `src/db/schema.ts` |
| `npm run db:migrate` | Apply migrations (uses `DATABASE_URL_UNPOOLED` when set) |
| `npm run db:seed` | Idempotent starter data |
| `npm run export:woocommerce` | Export the live WooCommerce store to `migration-data/` (read-only) |
| `npm run migrate:woocommerce` | Import `migration-data/` into the database (`--dry-run`, `--only=products,pages`) |
| `npm test` | Vitest unit tests |
| `npm run test:e2e` | Playwright smoke test (run `npm run build` first) |

## Migrating from WooCommerce

1. `WP_USER=... WP_PASSWORD=... npm run export:woocommerce` signs in to wp-admin and saves JSON exports to
   `migration-data/`. It only sends GET requests.
2. `npm run migrate:woocommerce -- --dry-run` previews the import. Run it again without `--dry-run` to import.

The import brings over products and their images (re-hosted in Blob, or Postgres when no Blob token is set),
categories that have products, customers with addresses, orders with their original numbers, and the About and Press
pages. It also writes the redirects for old WordPress URLs to `src/data/legacy-redirects.json`. Re-running it skips
anything already imported.

`migration-data/` contains customer personal data. It is git-ignored; delete it once the migration is final.

## Deploying to Vercel

1. Import the repository in Vercel and add the variables from `.env.example` (use production values and
   `PSIGATE_MODE=live`).
2. Create a Blob store in the project's Storage tab, which sets `BLOB_READ_WRITE_TOKEN`.
3. The `vercel-build` script runs database migrations before `next build`.
4. `vercel.json` schedules the cron jobs (expire unpaid orders, finish newsletter sends, refresh the Instagram token).
   They authenticate with `CRON_SECRET`.
5. Each payment sends PSiGate the return URL `https://camilleallen.com/api/psigate/return`. If the PSiGate account
   restricts return URLs, register that one.

## Tests

- `npm test` covers pricing and shipping zones, PSiGate request building and verification, Markdown sanitizing,
  slugs, and the migration's HTML-to-Markdown and image-size helpers.
- `npm run test:e2e` starts the production build with the payment simulator. A customer buys a temporary product,
  then an admin signs in with the emailed code and ships the order. It uses the database in `.env.local` and deletes
  everything it creates.
