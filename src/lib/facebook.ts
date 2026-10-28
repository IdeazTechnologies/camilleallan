import "server-only";
import { cacheLife, cacheTag } from "next/cache";
import { TAGS } from "@/lib/catalog";
import { getSettingValue, setSettingValue } from "@/lib/settings";

/**
 * Facebook Graph API with a Page access token (pages_read_engagement). A Page token generated
 * from a long-lived user token does not expire, so unlike Instagram there is no refresh job.
 */
export const FACEBOOK_SETTING_KEY = "facebook";

export type FacebookToken = { accessToken: string; pageName: string | null; savedAt: string | null };

export type FacebookPost = {
  id: string;
  message: string | null;
  imageUrl: string;
  permalink: string;
  timestamp: string;
};

const GRAPH = "https://graph.facebook.com";

export async function getFacebookToken(): Promise<FacebookToken | null> {
  const stored = await getSettingValue<FacebookToken>(FACEBOOK_SETTING_KEY);
  if (stored?.accessToken) return stored;
  const env = process.env.FACEBOOK_PAGE_ACCESS_TOKEN;
  return env ? { accessToken: env, pageName: null, savedAt: null } : null;
}

export async function saveFacebookToken(accessToken: string, pageName: string | null) {
  const value: FacebookToken = { accessToken, pageName, savedAt: new Date().toISOString() };
  await setSettingValue(FACEBOOK_SETTING_KEY, value);
  return value;
}

async function graph<T>(path: string, accessToken: string, params: Record<string, string> = {}): Promise<T> {
  const url = new URL(`${GRAPH}${path}`);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  url.searchParams.set("access_token", accessToken);
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) throw new Error(`Facebook API ${res.status}: ${(await res.text()).slice(0, 200)}`);
  return (await res.json()) as T;
}

/** Returns the Page name for a Page access token; throws if the token is invalid or not a Page token. */
export async function fetchFacebookPageName(accessToken: string) {
  const page = await graph<{ id: string; name?: string }>("/me", accessToken, { fields: "id,name" });
  return page.name ?? null;
}

export async function fetchFacebookPosts(accessToken: string, limit = 12): Promise<FacebookPost[]> {
  // Ask for extra posts because text-only posts have no picture and are dropped.
  const json = await graph<{
    data: Array<{ id: string; message?: string; full_picture?: string; permalink_url?: string; created_time: string }>;
  }>("/me/posts", accessToken, { fields: "id,message,full_picture,permalink_url,created_time", limit: String(limit * 2) });
  return json.data
    .filter((p) => p.full_picture && p.permalink_url)
    .slice(0, limit)
    .map((p) => ({
      id: p.id,
      message: p.message ?? null,
      imageUrl: p.full_picture!,
      permalink: p.permalink_url!,
      timestamp: p.created_time,
    }));
}

/** Cached feed for the storefront. Returns [] when Facebook is not configured or unavailable. */
export async function getFacebookFeed(limit = 12): Promise<FacebookPost[]> {
  "use cache";
  // Facebook CDN image URLs are signed and expire.
  cacheLife("hours");
  cacheTag(TAGS.facebook);
  const token = await getFacebookToken();
  if (!token) return [];
  try {
    return await fetchFacebookPosts(token.accessToken, limit);
  } catch (err) {
    console.error("[facebook]", err instanceof Error ? err.message : err);
    return [];
  }
}
