"use server";

import { updateTag } from "next/cache";
import { createElement } from "react";
import { COUNTRY_NAMES } from "@/data/countries";
import { TestEmail } from "@/emails/MiscEmails";
import { saveUploadedImages } from "@/lib/admin-images";
import { audit } from "@/lib/audit";
import { TAGS } from "@/lib/catalog";
import { requireAdmin } from "@/lib/dal";
import { sendEmail } from "@/lib/email/send";
import { checkbox, type ActionState } from "@/lib/forms";
import { fetchInstagramPosts, refreshInstagramToken, saveInstagramToken } from "@/lib/instagram";
import { readSettingsFresh, setSettingValue, SETTINGS_KEY, type StoreSettings } from "@/lib/settings";

export async function saveSettingsAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const admin = await requireAdmin();
  const current = await readSettingsFresh();
  const s = (k: keyof StoreSettings) => String(formData.get(k) ?? "").trim();
  const countries = s("shipToCountries")
    .split(/[\s,]+/)
    .map((c) => c.toUpperCase())
    .filter(Boolean);
  const unknown = countries.filter((c) => !(c in COUNTRY_NAMES));
  if (unknown.length) return { ok: false, message: `Unknown country code(s): ${unknown.join(", ")}` };
  const tax = Number(s("taxRatePercent") || 0);
  if (!Number.isFinite(tax) || tax < 0 || tax > 30) return { ok: false, message: "Tax rate must be between 0 and 30." };
  if (!s("storeName")) return { ok: false, message: "Store name is required." };

  const next: StoreSettings = {
    ...current,
    storeName: s("storeName"),
    tagline: s("tagline"),
    heroTitle: s("heroTitle"),
    heroSubtitle: s("heroSubtitle"),
    heroImageUrl: s("heroImageUrl"),
    introText: s("introText"),
    contactEmail: s("contactEmail"),
    contactPhone: s("contactPhone"),
    location: s("location"),
    currency: s("currency") === "CAD" ? "CAD" : "USD",
    taxRatePercent: tax,
    taxLabel: s("taxLabel") || "Tax",
    taxShipping: checkbox(formData, "taxShipping"),
    shipToCountries: countries,
    instagramHandle: s("instagramHandle").replace(/^@/, ""),
    facebookUrl: s("facebookUrl"),
    footerText: s("footerText"),
  };
  await setSettingValue(SETTINGS_KEY, next);
  await audit(admin.id, "settings.update", "settings", SETTINGS_KEY);
  updateTag(TAGS.settings);
  return { ok: true, message: "Settings saved." };
}

export async function uploadHeroImageAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const admin = await requireAdmin();
  try {
    const [img] = await saveUploadedImages(formData, "site");
    const current = await readSettingsFresh();
    await setSettingValue(SETTINGS_KEY, { ...current, heroImageUrl: img.url });
    await audit(admin.id, "settings.hero", "settings", SETTINGS_KEY);
    updateTag(TAGS.settings);
    return { ok: true, message: "Hero image updated." };
  } catch (err) {
    return { ok: false, message: err instanceof Error ? err.message : "Upload failed." };
  }
}

export async function saveInstagramTokenAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const admin = await requireAdmin();
  const intent = String(formData.get("intent") ?? "save");
  if (intent === "refresh") {
    const r = await refreshInstagramToken();
    updateTag(TAGS.instagram);
    return r.ok ? { ok: true, message: `Token refreshed. Expires ${r.expiresAt ?? "in about 60 days"}.` } : { ok: false, message: r.error };
  }
  const token = String(formData.get("token") ?? "").trim();
  if (!token) return { ok: false, message: "Paste a long-lived Instagram access token." };
  try {
    const posts = await fetchInstagramPosts(token, 3);
    await saveInstagramToken(token, 60 * 24 * 60 * 60);
    await audit(admin.id, "settings.instagram", "settings", "instagram");
    updateTag(TAGS.instagram);
    return { ok: true, message: `Connected. Found ${posts.length} recent post${posts.length === 1 ? "" : "s"}.` };
  } catch (err) {
    return { ok: false, message: err instanceof Error ? err.message : "That token didn't work." };
  }
}

export async function sendTestEmailAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const admin = await requireAdmin();
  const to = String(formData.get("to") ?? "").trim() || admin.email;
  const result = await sendEmail({ to, subject: "Test email from your store", template: "test", react: createElement(TestEmail) });
  return result.ok ? { ok: true, message: `Test email sent to ${to}. Check the email log for details.` } : { ok: false, message: `Sending failed: ${result.error}` };
}
