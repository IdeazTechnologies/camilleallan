"use server";

import { eq } from "drizzle-orm";
import { updateTag } from "next/cache";
import { db } from "@/db";
import { banners } from "@/db/schema";
import { audit } from "@/lib/audit";
import { TAGS } from "@/lib/catalog";
import { requireAdmin } from "@/lib/dal";
import { checkbox, type ActionState } from "@/lib/forms";
import { BANNER_PLACEMENTS as PLACEMENTS } from "@/lib/placements";

function dateOrNull(v: FormDataEntryValue | null) {
  const s = String(v ?? "").trim();
  if (!s) return null;
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? null : d;
}

export async function saveBannerAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const admin = await requireAdmin();
  const id = String(formData.get("id") ?? "") || null;
  const placement = PLACEMENTS.find(([p]) => p === formData.get("placement"))?.[0];
  if (!placement) return { ok: false, message: "Choose where the banner appears." };
  const title = String(formData.get("title") ?? "").trim() || null;
  const body = String(formData.get("body") ?? "").trim() || null;
  if (!title && !body) return { ok: false, message: "Enter a title or message." };
  const linkUrl = String(formData.get("linkUrl") ?? "").trim() || null;
  if (linkUrl && !/^(\/|https?:\/\/)/.test(linkUrl)) return { ok: false, message: "Links must start with / or https://" };
  const tone = (["info", "promo", "notice"] as const).find((t) => t === formData.get("tone")) ?? "info";
  const row = {
    placement,
    title,
    body,
    linkUrl,
    linkLabel: String(formData.get("linkLabel") ?? "").trim() || null,
    tone,
    active: checkbox(formData, "active"),
    startsAt: dateOrNull(formData.get("startsAt")),
    endsAt: dateOrNull(formData.get("endsAt")),
    sortOrder: Number.parseInt(String(formData.get("sortOrder") ?? "0"), 10) || 0,
  };
  if (id) await db.update(banners).set(row).where(eq(banners.id, id));
  else await db.insert(banners).values(row);
  await audit(admin.id, id ? "banner.update" : "banner.create", "banner", id, { placement, title });
  updateTag(TAGS.banners);
  return { ok: true, message: "Banner saved." };
}

export async function deleteBannerAction(formData: FormData) {
  const admin = await requireAdmin();
  const id = String(formData.get("id"));
  await db.delete(banners).where(eq(banners.id, id));
  await audit(admin.id, "banner.delete", "banner", id);
  updateTag(TAGS.banners);
}
