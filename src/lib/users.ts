import "server-only";
import { and, eq, isNull } from "drizzle-orm";
import { db } from "@/db";
import { orders, users } from "@/db/schema";
import { normalizeEmail } from "@/lib/utils";

function adminEmails() {
  return (process.env.ADMIN_EMAILS ?? "")
    .split(",")
    .map((e) => normalizeEmail(e))
    .filter(Boolean);
}

export async function promoteIfAdmin(userId: string | undefined, email: string | null | undefined) {
  if (!userId || !email || !adminEmails().includes(normalizeEmail(email))) return;
  await db.update(users).set({ role: "admin" }).where(eq(users.id, userId));
}

/** Promote an admin and attach guest orders placed with the same email. */
export async function finalizeNewUser(userId: string, email: string) {
  await promoteIfAdmin(userId, email);
  await db
    .update(orders)
    .set({ userId })
    .where(and(eq(orders.email, normalizeEmail(email)), isNull(orders.userId)));
}
