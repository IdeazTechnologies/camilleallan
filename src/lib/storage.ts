import "server-only";
import { del, put } from "@vercel/blob";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { media } from "@/db/schema";

export const MAX_UPLOAD_BYTES = 4 * 1024 * 1024;
const TYPES: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/gif": "gif",
  "image/avif": "avif",
};

export function blobConfigured() {
  return !!process.env.BLOB_READ_WRITE_TOKEN;
}

export async function saveImage(file: File, folder: string) {
  const ext = TYPES[file.type];
  if (!ext) throw new Error("Please upload a JPEG, PNG, WebP, GIF or AVIF image.");
  if (file.size > MAX_UPLOAD_BYTES) throw new Error("Images must be smaller than 4 MB.");

  if (blobConfigured()) {
    const blob = await put(`${folder}/${crypto.randomUUID()}.${ext}`, file, {
      access: "public",
      contentType: file.type,
      cacheControlMaxAge: 60 * 60 * 24 * 365,
    });
    return blob.url;
  }

  const [row] = await db
    .insert(media)
    .values({ contentType: file.type, size: file.size, data: Buffer.from(await file.arrayBuffer()) })
    .returning({ id: media.id });
  return `/media/${row.id}`;
}

export async function deleteImage(url: string) {
  try {
    if (url.startsWith("/media/")) {
      await db.delete(media).where(eq(media.id, url.slice("/media/".length)));
    } else if (url.includes(".blob.vercel-storage.com") && blobConfigured()) {
      await del(url);
    }
  } catch (err) {
    console.error("Failed to delete image", url, err);
  }
}
