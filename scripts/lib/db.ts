import "../load-env";
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as schema from "../../src/db/schema";

export function connect() {
  const url = process.env.DATABASE_URL_UNPOOLED ?? process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL must be set (in .env.local or the environment).");
  const pool = new Pool({ connectionString: url, max: 4 });
  return { db: drizzle(pool, { schema }), pool };
}

export type ScriptDb = ReturnType<typeof connect>["db"];
export { schema };
