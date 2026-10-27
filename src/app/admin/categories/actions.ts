"use server";

import { and, eq, ne } from "drizzle-orm";
import { updateTag } from "next/cache";
import { db } from "@/db";
import { categories } from "@/db/schema";
import { audit } from "@/lib/audit";
import { TAGS } from "@/lib/catalog";
import { requireAdmin } from "@/lib/dal";
import type { ActionState } from "@/lib/forms";
import { slugify } from "@/lib/utils";

export async function saveCategoryAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const admin = await requireAdmin();
  const id = String(formData.get("id") ?? "") || null;
  const name = String(formData.get("name") ?? "").trim();
  if (name.length < 2) return { ok: false, message: "Name is required." };
  const slug = slugify(String(formData.get("slug") ?? "") || name);
  const clash = await db.query.categories.findFirst({
    where: id ? and(eq(categories.slug, slug), ne(categories.id, id)) : eq(categories.slug, slug),
  });
  if (clash) return { ok: false, message: `Another category already uses the URL "${slug}".` };
  const row = {
    name,
    slug,
    description: String(formData.get("description") ?? "").trim() || null,
    sortOrder: Number.parseInt(String(formData.get("sortOrder") ?? "0"), 10) || 0,
  };
  if (id) await db.update(categories).set(row).where(eq(categories.id, id));
  else await db.insert(categories).values(row);
  await audit(admin.id, id ? "category.update" : "category.create", "category", id, row);
  updateTag(TAGS.catalog);
  return { ok: true, message: id ? "Category saved." : "Category added." };
}

export async function deleteCategoryAction(formData: FormData) {
  const admin = await requireAdmin();
  const id = String(formData.get("id"));
  await db.delete(categories).where(eq(categories.id, id));
  await audit(admin.id, "category.delete", "category", id);
  updateTag(TAGS.catalog);
}
