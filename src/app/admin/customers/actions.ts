"use server";

import { eq } from "drizzle-orm";
import { refresh } from "next/cache";
import { db } from "@/db";
import { sessions, users } from "@/db/schema";
import { audit } from "@/lib/audit";
import { requireAdmin } from "@/lib/dal";

export async function setRoleAction(formData: FormData) {
  const admin = await requireAdmin();
  const id = String(formData.get("id"));
  const role = formData.get("role") === "admin" ? "admin" : "customer";
  if (id === admin.id && role !== "admin") return;
  await db.update(users).set({ role }).where(eq(users.id, id));
  // Force a fresh sign-in so the new role takes effect everywhere.
  await db.delete(sessions).where(eq(sessions.userId, id));
  await audit(admin.id, "user.role", "user", id, { role });
  refresh();
}
