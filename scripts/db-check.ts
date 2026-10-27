import "./load-env";
import { Pool } from "pg";

async function main() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL, max: 1 });
  try {
    const started = Date.now();
    const { rows } = await pool.query(
      "select current_database() as db, version() as version, now() as now",
    );
    const { rows: tables } = await pool.query(
      "select count(*)::int as n from information_schema.tables where table_schema = 'public'",
    );
    console.log(`Connected in ${Date.now() - started} ms`);
    console.log(`Database: ${rows[0].db}`);
    console.log(`Server:   ${String(rows[0].version).split(",")[0]}`);
    console.log(`Time:     ${rows[0].now.toISOString()}`);
    console.log(`Tables in public schema: ${tables[0].n}`);
  } finally {
    await pool.end();
  }
}

main().catch((err) => {
  console.error("Database check failed:", err.message);
  process.exit(1);
});
