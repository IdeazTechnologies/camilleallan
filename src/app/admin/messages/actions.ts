"use server";

import { eq } from "drizzle-orm";
import { refresh } from "next/cache";
import { db } from "@/db";
import { contactMessages } from "@/db/schema";
import { requireAdmin } from "@/lib/dal";

export async function setMessageStatusAction(formData: FormData) {
  await requireAdmin();
  const status = (["new", "read", "archived"] as const).find((s) => s === formData.get("status"));
  if (!status) return;
  await db.update(contactMessages).set({ status }).where(eq(contactMessages.id, String(formData.get("id"))));
  refresh();
}

export async function deleteMessageAction(formData: FormData) {
  await requireAdmin();
  await db.delete(contactMessages).where(eq(contactMessages.id, String(formData.get("id"))));
  refresh();
}
