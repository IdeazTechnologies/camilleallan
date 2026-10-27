import "./load-env";
import { Pool } from "pg";

async function main() {
  const email = process.argv[2]?.trim().toLowerCase();
  if (!email || !email.includes("@")) {
    console.error("Usage: npm run make-admin -- someone@example.com");
    process.exit(1);
  }
  const pool = new Pool({ connectionString: process.env.DATABASE_URL, max: 1 });
  try {
    const { rows } = await pool.query(
      `insert into users (id, email, role) values ($1, $2, 'admin')
       on conflict (email) do update set role = 'admin'
       returning id, email, role`,
      [crypto.randomUUID(), email],
    );
    console.log(`${rows[0].email} is now an admin. They can sign in at /login with an email code.`);
  } finally {
    await pool.end();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
