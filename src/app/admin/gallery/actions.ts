"use server";

import { and, asc, eq, ne, sql } from "drizzle-orm";
import { updateTag } from "next/cache";
import { redirect } from "next/navigation";
import { db } from "@/db";
import { galleryAlbums, galleryImages } from "@/db/schema";
import { saveUploadedImages } from "@/lib/admin-images";
import { audit } from "@/lib/audit";
import { TAGS } from "@/lib/catalog";
import { requireAdmin } from "@/lib/dal";
import { checkbox, type ActionState } from "@/lib/forms";
import { deleteImage } from "@/lib/storage";
import { slugify } from "@/lib/utils";

export async function saveAlbumAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const admin = await requireAdmin();
  const id = String(formData.get("id") ?? "") || null;
  const title = String(formData.get("title") ?? "").trim();
  if (title.length < 2) return { ok: false, message: "Title is required." };
  const slug = slugify(String(formData.get("slug") ?? "") || title);
  const clash = await db.query.galleryAlbums.findFirst({
    where: id ? and(eq(galleryAlbums.slug, slug), ne(galleryAlbums.id, id)) : eq(galleryAlbums.slug, slug),
  });
  if (clash) return { ok: false, message: `Another album already uses the URL "${slug}".` };
  const row = {
    title,
    slug,
    description: String(formData.get("description") ?? "").trim() || null,
    published: checkbox(formData, "published"),
    sortOrder: Number.parseInt(String(formData.get("sortOrder") ?? "0"), 10) || 0,
  };
  let albumId = id;
  if (id) await db.update(galleryAlbums).set(row).where(eq(galleryAlbums.id, id));
  else albumId = (await db.insert(galleryAlbums).values(row).returning({ id: galleryAlbums.id }))[0].id;
  await audit(admin.id, id ? "album.update" : "album.create", "gallery_album", albumId, { title });
  updateTag(TAGS.gallery);
  if (!id) redirect(`/admin/gallery/${albumId}`);
  return { ok: true, message: "Album saved." };
}

export async function deleteAlbumAction(formData: FormData) {
  const admin = await requireAdmin();
  const id = String(formData.get("id"));
  const images = await db.query.galleryImages.findMany({ where: eq(galleryImages.albumId, id) });
  await db.delete(galleryAlbums).where(eq(galleryAlbums.id, id));
  for (const img of images) await deleteImage(img.url);
  await audit(admin.id, "album.delete", "gallery_album", id);
  updateTag(TAGS.gallery);
  redirect("/admin/gallery");
}

export async function uploadGalleryImagesAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  await requireAdmin();
  const albumId = String(formData.get("ownerId"));
  try {
    const saved = await saveUploadedImages(formData, `gallery/${albumId}`);
    const [{ max }] = await db
      .select({ max: sql<number>`coalesce(max(${galleryImages.sortOrder}), -1)::int` })
      .from(galleryImages)
      .where(eq(galleryImages.albumId, albumId));
    await db.insert(galleryImages).values(saved.map((s, i) => ({ albumId, ...s, sortOrder: max + 1 + i })));
    updateTag(TAGS.gallery);
    return { ok: true, message: `${saved.length} uploaded.` };
  } catch (err) {
    return { ok: false, message: err instanceof Error ? err.message : "Upload failed." };
  }
}

export async function updateGalleryImageAction(formData: FormData) {
  await requireAdmin();
  const id = String(formData.get("id"));
  const intent = String(formData.get("intent"));
  const image = await db.query.galleryImages.findFirst({ where: eq(galleryImages.id, id) });
  if (!image) return;
  if (intent === "delete") {
    await db.delete(galleryImages).where(eq(galleryImages.id, id));
    await deleteImage(image.url);
  } else if (intent === "alt") {
    await db
      .update(galleryImages)
      .set({
        alt: String(formData.get("alt") ?? "").trim() || null,
        caption: String(formData.get("caption") ?? "").trim() || null,
      })
      .where(eq(galleryImages.id, id));
  } else {
    const siblings = await db.query.galleryImages.findMany({
      where: eq(galleryImages.albumId, image.albumId),
      orderBy: [asc(galleryImages.sortOrder), asc(galleryImages.createdAt)],
    });
    const order = siblings.map((s) => s.id);
    const from = order.indexOf(id);
    const to = intent === "first" ? 0 : intent === "up" ? Math.max(0, from - 1) : Math.min(order.length - 1, from + 1);
    order.splice(to, 0, ...order.splice(from, 1));
    await db.transaction(async (tx) => {
      for (const [i, imageId] of order.entries()) await tx.update(galleryImages).set({ sortOrder: i }).where(eq(galleryImages.id, imageId));
    });
  }
  updateTag(TAGS.gallery);
}
