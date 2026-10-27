import { defineConfig, devices } from "@playwright/test";

const PORT = Number(process.env.E2E_PORT ?? 3100);
const baseURL = `http://localhost:${PORT}`;

/**
 * Smoke test of browse -> cart -> checkout (payment simulator) -> admin sign-in -> fulfil.
 * Runs against the DATABASE_URL in .env.local and cleans up the rows it creates.
 * `npm run build` first (or set E2E_DEV=1 to use the dev server).
 */
export default defineConfig({
  testDir: "tests/e2e",
  timeout: 120_000,
  expect: { timeout: 20_000 },
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: [["list"]],
  use: {
    baseURL,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: {
    command: process.env.E2E_DEV ? `npx next dev -p ${PORT}` : `npx next start -p ${PORT}`,
    url: baseURL,
    timeout: 180_000,
    reuseExistingServer: !process.env.CI,
    stdout: "pipe",
    env: {
      PSIGATE_MODE: "simulate",
      EMAIL_TRANSPORT: "outbox",
      APP_URL: baseURL,
      AUTH_URL: baseURL,
      AUTH_TRUST_HOST: "true",
    },
  },
});
