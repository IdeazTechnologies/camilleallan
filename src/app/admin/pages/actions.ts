"use server";

import { and, eq, ne } from "drizzle-orm";
import { updateTag } from "next/cache";
import { redirect } from "next/navigation";
import { db } from "@/db";
import { pages, type PageLayout } from "@/db/schema";
import { audit } from "@/lib/audit";
import { TAGS } from "@/lib/catalog";
import { requireAdmin } from "@/lib/dal";
import { checkbox, formValues, type ActionState } from "@/lib/forms";
import { slugify } from "@/lib/utils";

/** Slugs used by built-in routes; a CMS page with one of these would never be reachable. */
const RESERVED = new Set(["shop", "product", "gallery", "cart", "checkout", "account", "login", "admin", "api", "contact", "newsletter", "media", "sitemap.xml", "robots.txt"]);

export async function savePageAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const admin = await requireAdmin();
  const id = String(formData.get("id") ?? "") || null;
  const values = formValues(formData);
  const title = String(formData.get("title") ?? "").trim();
  if (title.length < 2) return { ok: false, message: "Title is required.", values };
  const slug = slugify(String(formData.get("slug") ?? "") || title);
  if (RESERVED.has(slug)) return { ok: false, message: `"${slug}" is reserved by the site. Choose another URL.`, values };
  const clash = await db.query.pages.findFirst({ where: id ? and(eq(pages.slug, slug), ne(pages.id, id)) : eq(pages.slug, slug) });
  if (clash) return { ok: false, message: `Another page already uses /${slug}.`, values };

  const row = {
    title,
    slug,
    body: String(formData.get("body") ?? ""),
    layout: (["cards", "faq"].includes(String(formData.get("layout"))) ? formData.get("layout") : "prose") as PageLayout,
    metaDescription: String(formData.get("metaDescription") ?? "").trim() || null,
    published: checkbox(formData, "published"),
    showInNav: checkbox(formData, "showInNav"),
    navOrder: Number.parseInt(String(formData.get("navOrder") ?? "0"), 10) || 0,
  };
  let pageId = id;
  if (id) await db.update(pages).set(row).where(eq(pages.id, id));
  else pageId = (await db.insert(pages).values(row).returning({ id: pages.id }))[0].id;
  await audit(admin.id, id ? "page.update" : "page.create", "page", pageId, { title, slug });
  updateTag(TAGS.pages);
  if (!id) redirect(`/admin/pages/${pageId}`);
  return { ok: true, message: "Page saved.", values: { ...values, slug } };
}

export async function deletePageAction(formData: FormData) {
  const admin = await requireAdmin();
  const id = String(formData.get("id"));
  await db.delete(pages).where(eq(pages.id, id));
  await audit(admin.id, "page.delete", "page", id);
  updateTag(TAGS.pages);
  redirect("/admin/pages");
}
