import { attachDatabasePool } from "@vercel/functions";
import { drizzle, type NodePgDatabase } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as schema from "./schema";

export type Database = NodePgDatabase<typeof schema>;
export type Transaction = Parameters<Parameters<Database["transaction"]>[0]>[0];

const globalForDb = globalThis as unknown as { __pgPool?: Pool };

function createPool() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error("DATABASE_URL is not set. Copy .env.example to .env.local and fill it in.");
  }
  const pool = new Pool({
    connectionString,
    max: 10,
    idleTimeoutMillis: 5_000,
    connectionTimeoutMillis: 15_000,
  });
  // Lets Vercel Fluid compute close idle clients before a function instance is suspended.
  attachDatabasePool(pool);
  return pool;
}

function getPool() {
  if (!globalForDb.__pgPool) globalForDb.__pgPool = createPool();
  return globalForDb.__pgPool;
}

let instance: Database | undefined;

export function getDb(): Database {
  if (!instance) instance = drizzle(getPool(), { schema });
  return instance;
}

// Lazily connect so importing this module during the build never requires a database.
export const db = new Proxy({} as Database, {
  get(_target, prop) {
    const real = getDb() as unknown as Record<PropertyKey, unknown>;
    const value = Reflect.get(real, prop);
    return typeof value === "function" ? (value as (...a: unknown[]) => unknown).bind(real) : value;
  },
});

export { schema };
