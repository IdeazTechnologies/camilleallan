import "server-only";
import { cacheLife, cacheTag } from "next/cache";
import { TAGS } from "@/lib/catalog";
import { getSettingValue, setSettingValue } from "@/lib/settings";

/**
 * Instagram API with Instagram Login (graph.instagram.com). Requires a long-lived
 * access token for a Business/Creator account; tokens last 60 days and are refreshed weekly by cron.
 */
export const INSTAGRAM_SETTING_KEY = "instagram";

export type InstagramToken = { accessToken: string; expiresAt: string | null; refreshedAt: string | null };

export type InstagramPost = {
  id: string;
  caption: string | null;
  mediaType: "IMAGE" | "VIDEO" | "CAROUSEL_ALBUM";
  imageUrl: string;
  permalink: string;
  timestamp: string;
};

const GRAPH = "https://graph.instagram.com";

export async function getInstagramToken(): Promise<InstagramToken | null> {
  const stored = await getSettingValue<InstagramToken>(INSTAGRAM_SETTING_KEY);
  if (stored?.accessToken) return stored;
  const env = process.env.INSTAGRAM_ACCESS_TOKEN;
  return env ? { accessToken: env, expiresAt: null, refreshedAt: null } : null;
}

export async function saveInstagramToken(accessToken: string, expiresInSeconds?: number) {
  const value: InstagramToken = {
    accessToken,
    expiresAt: expiresInSeconds ? new Date(Date.now() + expiresInSeconds * 1000).toISOString() : null,
    refreshedAt: new Date().toISOString(),
  };
  await setSettingValue(INSTAGRAM_SETTING_KEY, value);
  return value;
}

export async function fetchInstagramPosts(accessToken: string, limit = 12): Promise<InstagramPost[]> {
  const url = new URL(`${GRAPH}/me/media`);
  url.searchParams.set("fields", "id,caption,media_type,media_url,thumbnail_url,permalink,timestamp");
  url.searchParams.set("limit", String(limit));
  url.searchParams.set("access_token", accessToken);
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) throw new Error(`Instagram API ${res.status}: ${(await res.text()).slice(0, 200)}`);
  const json = (await res.json()) as {
    data: Array<{
      id: string;
      caption?: string;
      media_type: InstagramPost["mediaType"];
      media_url?: string;
      thumbnail_url?: string;
      permalink: string;
      timestamp: string;
    }>;
  };
  return json.data
    .map((m) => ({
      id: m.id,
      caption: m.caption ?? null,
      mediaType: m.media_type,
      imageUrl: (m.media_type === "VIDEO" ? m.thumbnail_url : m.media_url) ?? "",
      permalink: m.permalink,
      timestamp: m.timestamp,
    }))
    .filter((p) => p.imageUrl);
}

/** Cached feed for the storefront. Returns [] when Instagram is not configured or unavailable. */
export async function getInstagramFeed(limit = 12): Promise<InstagramPost[]> {
  "use cache";
  // Instagram CDN URLs expire after a while, so keep this comfortably short.
  cacheLife("hours");
  cacheTag(TAGS.instagram);
  const token = await getInstagramToken();
  if (!token) return [];
  try {
    return await fetchInstagramPosts(token.accessToken, limit);
  } catch (err) {
    console.error("[instagram]", err instanceof Error ? err.message : err);
    return [];
  }
}

export async function refreshInstagramToken() {
  const token = await getInstagramToken();
  if (!token) return { ok: false as const, error: "No Instagram token configured." };
  const url = new URL(`${GRAPH}/refresh_access_token`);
  url.searchParams.set("grant_type", "ig_refresh_token");
  url.searchParams.set("access_token", token.accessToken);
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) return { ok: false as const, error: `Instagram ${res.status}: ${(await res.text()).slice(0, 200)}` };
  const json = (await res.json()) as { access_token: string; expires_in: number };
  const saved = await saveInstagramToken(json.access_token, json.expires_in);
  return { ok: true as const, expiresAt: saved.expiresAt };
}
