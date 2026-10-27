"use server";

import { eq } from "drizzle-orm";
import { refresh } from "next/cache";
import { redirect } from "next/navigation";
import { createElement } from "react";
import { z } from "zod";
import { db } from "@/db";
import { newsletterCampaigns, newsletterSubscribers } from "@/db/schema";
import { NewsletterCampaignEmail } from "@/emails/MiscEmails";
import { audit } from "@/lib/audit";
import { requireAdmin } from "@/lib/dal";
import { sendEmail } from "@/lib/email/send";
import type { ActionState } from "@/lib/forms";
import { renderMarkdown } from "@/lib/markdown";
import { processCampaignBatch, startCampaign } from "@/lib/newsletter";
import { appUrl, normalizeEmail } from "@/lib/utils";

export async function saveCampaignAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const admin = await requireAdmin();
  const id = String(formData.get("id") ?? "") || null;
  const subject = String(formData.get("subject") ?? "").trim();
  const body = String(formData.get("body") ?? "");
  if (subject.length < 3) return { ok: false, message: "Enter a subject." };
  if (id) {
    const existing = await db.query.newsletterCampaigns.findFirst({ where: eq(newsletterCampaigns.id, id) });
    if (existing?.status !== "draft") return { ok: false, message: "This campaign has already been sent and can't be edited." };
    await db.update(newsletterCampaigns).set({ subject, body }).where(eq(newsletterCampaigns.id, id));
    refresh();
    return { ok: true, message: "Draft saved." };
  }
  const [created] = await db.insert(newsletterCampaigns).values({ subject, body, createdBy: admin.id }).returning({ id: newsletterCampaigns.id });
  redirect(`/admin/newsletter/${created.id}`);
}

export async function sendCampaignTestAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const admin = await requireAdmin();
  const campaign = await db.query.newsletterCampaigns.findFirst({ where: eq(newsletterCampaigns.id, String(formData.get("id"))) });
  if (!campaign) return { ok: false, message: "Campaign not found." };
  const to = String(formData.get("to") ?? "").trim() || admin.email;
  const result = await sendEmail({
    to,
    subject: `[TEST] ${campaign.subject}`,
    template: `campaign-test:${campaign.id}`,
    react: createElement(NewsletterCampaignEmail, {
      subject: campaign.subject,
      html: renderMarkdown(campaign.body),
      unsubscribeUrl: appUrl("/newsletter/unsubscribe?token=test"),
    }),
  });
  return result.ok ? { ok: true, message: `Test sent to ${to}.` } : { ok: false, message: `Failed: ${result.error}` };
}

export async function startCampaignAction(id: string) {
  const admin = await requireAdmin();
  const campaign = await db.query.newsletterCampaigns.findFirst({ where: eq(newsletterCampaigns.id, id) });
  if (!campaign) return { ok: false as const, message: "Campaign not found." };
  if (campaign.status === "draft") {
    await startCampaign(id);
    await audit(admin.id, "campaign.start", "newsletter_campaign", id, { subject: campaign.subject });
  }
  return { ok: true as const };
}

export async function sendCampaignBatchAction(id: string) {
  await requireAdmin();
  return processCampaignBatch(id, 20);
}

export async function deleteCampaignAction(formData: FormData) {
  await requireAdmin();
  await db.delete(newsletterCampaigns).where(eq(newsletterCampaigns.id, String(formData.get("id"))));
  redirect("/admin/newsletter");
}

const emailSchema = z.email();

export async function addSubscriberAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const admin = await requireAdmin();
  const lines = String(formData.get("emails") ?? "")
    .split(/[\s,;]+/)
    .map(normalizeEmail)
    .filter(Boolean);
  const valid = lines.filter((e) => emailSchema.safeParse(e).success);
  if (valid.length === 0) return { ok: false, message: "Enter at least one valid email address." };
  for (const email of valid) {
    await db
      .insert(newsletterSubscribers)
      .values({ email, status: "subscribed", source: "admin", confirmedAt: new Date() })
      .onConflictDoNothing();
  }
  await audit(admin.id, "subscribers.add", "newsletter", null, { count: valid.length });
  refresh();
  const skipped = lines.length - valid.length;
  return { ok: true, message: `Added ${valid.length} subscriber${valid.length === 1 ? "" : "s"}${skipped ? ` (${skipped} invalid skipped)` : ""}. Existing entries were left unchanged.` };
}

export async function setSubscriberStatusAction(formData: FormData) {
  await requireAdmin();
  const status = formData.get("status") === "subscribed" ? "subscribed" : "unsubscribed";
  await db
    .update(newsletterSubscribers)
    .set(status === "subscribed" ? { status, unsubscribedAt: null } : { status, unsubscribedAt: new Date() })
    .where(eq(newsletterSubscribers.id, String(formData.get("id"))));
  refresh();
}
