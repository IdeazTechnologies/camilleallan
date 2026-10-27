import "server-only";
import { eq } from "drizzle-orm";
import { cacheLife, cacheTag } from "next/cache";
import { db } from "@/db";
import { settings } from "@/db/schema";

export type StoreSettings = {
  storeName: string;
  tagline: string;
  heroTitle: string;
  heroSubtitle: string;
  heroImageUrl: string;
  introText: string;
  contactEmail: string;
  contactPhone: string;
  location: string;
  currency: "CAD" | "USD";
  taxRatePercent: number;
  taxLabel: string;
  taxShipping: boolean;
  shipToCountries: string[];
  instagramHandle: string;
  facebookUrl: string;
  footerText: string;
};

export const DEFAULT_SETTINGS: StoreSettings = {
  storeName: "Camille Allen",
  tagline: "Dolls and sculptures created by Camille Allen",
  heroTitle: "Sculpted with love, one tiny detail at a time",
  heroSubtitle:
    "Lifelike baby dolls and one-of-a-kind sculptures, handcrafted in British Columbia by artist Camille Allen.",
  heroImageUrl: "",
  introText:
    "Every piece begins as a lump of clay and a lot of patience. Browse the dolls and sculptures available today, or get in touch about a custom piece.",
  contactEmail: "camille@camilleallen.com",
  contactPhone: "",
  location: "British Columbia, Canada",
  currency: "USD",
  taxRatePercent: 0,
  taxLabel: "Tax",
  taxShipping: true,
  // Empty means ship worldwide.
  shipToCountries: [],
  instagramHandle: "camilleallensculptures",
  facebookUrl: "https://www.facebook.com/pages/Camille-Allen-Dolls/72342664718",
  footerText: "Original sculptures by Camille Allen. All rights reserved.",
};

export const SETTINGS_KEY = "store";

export async function getSettings(): Promise<StoreSettings> {
  "use cache";
  cacheLife("days");
  cacheTag("settings");
  const row = await db.query.settings.findFirst({ where: eq(settings.key, SETTINGS_KEY) });
  return { ...DEFAULT_SETTINGS, ...((row?.value as Partial<StoreSettings>) ?? {}) };
}

/** Uncached read for admin forms and payment flows. */
export async function readSettingsFresh(): Promise<StoreSettings> {
  const row = await db.query.settings.findFirst({ where: eq(settings.key, SETTINGS_KEY) });
  return { ...DEFAULT_SETTINGS, ...((row?.value as Partial<StoreSettings>) ?? {}) };
}

export async function getSettingValue<T>(key: string): Promise<T | null> {
  const row = await db.query.settings.findFirst({ where: eq(settings.key, key) });
  return (row?.value as T) ?? null;
}

export async function setSettingValue(key: string, value: unknown) {
  await db
    .insert(settings)
    .values({ key, value })
    .onConflictDoUpdate({ target: settings.key, set: { value, updatedAt: new Date() } });
}

export { COUNTRY_NAMES } from "@/data/countries";

export const CA_PROVINCES = [
  ["AB", "Alberta"], ["BC", "British Columbia"], ["MB", "Manitoba"], ["NB", "New Brunswick"],
  ["NL", "Newfoundland and Labrador"], ["NS", "Nova Scotia"], ["NT", "Northwest Territories"],
  ["NU", "Nunavut"], ["ON", "Ontario"], ["PE", "Prince Edward Island"], ["QC", "Quebec"],
  ["SK", "Saskatchewan"], ["YT", "Yukon"],
] as const;
