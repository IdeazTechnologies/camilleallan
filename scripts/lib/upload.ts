import { put } from "@vercel/blob";
import { imageSize } from "./image-size";
import { schema, type ScriptDb } from "./db";

const EXT: Record<string, string> = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp", "image/gif": "gif" };
const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) CamilleAllenMigration/1.0";

export type StoredImage = { url: string; width: number | null; height: number | null };

/** Downloads a remote image and stores it in Vercel Blob (when configured) or the `media` table. */
export function createImageRehoster(db: ScriptDb) {
  const cache = new Map<string, Promise<StoredImage>>();

  async function rehost(src: string, folder: string): Promise<StoredImage> {
    const url = src.replace(/^http:\/\//, "https://");
    const res = await fetch(url, { headers: { "User-Agent": UA } });
    if (!res.ok) throw new Error(`GET ${url}: HTTP ${res.status}`);
    const buf = Buffer.from(await res.arrayBuffer());
    const headerType = res.headers.get("content-type")?.split(";")[0].trim() ?? "";
    const contentType = EXT[headerType] ? headerType : guessType(url);
    if (!contentType) throw new Error(`${url}: unsupported content type "${headerType}"`);
    const size = imageSize(buf);

    if (process.env.BLOB_READ_WRITE_TOKEN) {
      const blob = await put(`${folder}/${crypto.randomUUID()}.${EXT[contentType]}`, buf, {
        access: "public",
        contentType,
        cacheControlMaxAge: 60 * 60 * 24 * 365,
      });
      return { url: blob.url, width: size?.width ?? null, height: size?.height ?? null };
    }
    const [row] = await db
      .insert(schema.media)
      .values({ contentType, size: buf.length, data: buf })
      .returning({ id: schema.media.id });
    return { url: `/media/${row.id}`, width: size?.width ?? null, height: size?.height ?? null };
  }

  return (src: string, folder: string) => {
    let pending = cache.get(src);
    if (!pending) {
      pending = rehost(src, folder);
      cache.set(src, pending);
    }
    return pending;
  };
}

function guessType(url: string) {
  const ext = url.split("?")[0].split(".").pop()?.toLowerCase();
  if (ext === "jpg" || ext === "jpeg") return "image/jpeg";
  if (ext === "png") return "image/png";
  if (ext === "webp") return "image/webp";
  if (ext === "gif") return "image/gif";
  return null;
}
