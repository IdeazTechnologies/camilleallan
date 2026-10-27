import "server-only";
import { and, eq, sql } from "drizzle-orm";
import { createElement } from "react";
import { db } from "@/db";
import { campaignRecipients, newsletterCampaigns, newsletterSubscribers } from "@/db/schema";
import { NewsletterCampaignEmail, NewsletterConfirmEmail } from "@/emails/MiscEmails";
import { sendEmail } from "@/lib/email/send";
import { renderMarkdown } from "@/lib/markdown";
import { appUrl, normalizeEmail } from "@/lib/utils";

export async function requestSubscription(rawEmail: string, source: string, name?: string | null) {
  const email = normalizeEmail(rawEmail);
  const existing = await db.query.newsletterSubscribers.findFirst({ where: eq(newsletterSubscribers.email, email) });
  if (existing?.status === "subscribed") return { alreadySubscribed: true };

  const [sub] = existing
    ? await db
        .update(newsletterSubscribers)
        .set({ status: "pending", source, name: name ?? existing.name, unsubscribedAt: null })
        .where(eq(newsletterSubscribers.id, existing.id))
        .returning()
    : await db.insert(newsletterSubscribers).values({ email, source, name, status: "pending" }).returning();

  await sendEmail({
    to: email,
    subject: "Please confirm your subscription",
    template: "newsletter-confirm",
    react: createElement(NewsletterConfirmEmail, { confirmUrl: appUrl(`/newsletter/confirm?token=${sub.token}`) }),
  });
  return { alreadySubscribed: false };
}

export async function confirmSubscription(token: string) {
  const [row] = await db
    .update(newsletterSubscribers)
    .set({ status: "subscribed", confirmedAt: new Date(), unsubscribedAt: null })
    .where(eq(newsletterSubscribers.token, token))
    .returning({ email: newsletterSubscribers.email });
  return row ?? null;
}

export async function unsubscribe(token: string) {
  const [row] = await db
    .update(newsletterSubscribers)
    .set({ status: "unsubscribed", unsubscribedAt: new Date() })
    .where(eq(newsletterSubscribers.token, token))
    .returning({ email: newsletterSubscribers.email });
  return row ?? null;
}

export async function setSubscriptionForUser(userId: string, email: string, subscribed: boolean) {
  const normalized = normalizeEmail(email);
  await db
    .insert(newsletterSubscribers)
    .values({
      email: normalized,
      userId,
      source: "account",
      status: subscribed ? "subscribed" : "unsubscribed",
      confirmedAt: subscribed ? new Date() : null,
      unsubscribedAt: subscribed ? null : new Date(),
    })
    .onConflictDoUpdate({
      target: newsletterSubscribers.email,
      set: subscribed
        ? { status: "subscribed", userId, confirmedAt: new Date(), unsubscribedAt: null }
        : { status: "unsubscribed", userId, unsubscribedAt: new Date() },
    });
}

/** Queues every current subscriber for a campaign and marks it sending. */
export async function startCampaign(campaignId: string) {
  await db.execute(sql`
    insert into ${campaignRecipients} (campaign_id, subscriber_id)
    select ${campaignId}, id from ${newsletterSubscribers} where status = 'subscribed'
    on conflict do nothing
  `);
  await db
    .update(newsletterCampaigns)
    .set({ status: "sending", startedAt: new Date() })
    .where(eq(newsletterCampaigns.id, campaignId));
}

/** Sends the next batch for a campaign. Safe to call repeatedly (from the admin page or the cron job). */
export async function processCampaignBatch(campaignId: string, batchSize = 25) {
  const campaign = await db.query.newsletterCampaigns.findFirst({ where: eq(newsletterCampaigns.id, campaignId) });
  if (!campaign || campaign.status !== "sending") return { done: true, sent: 0, failed: 0, remaining: 0 };

  const batch = await db
    .select({
      subscriberId: newsletterSubscribers.id,
      email: newsletterSubscribers.email,
      token: newsletterSubscribers.token,
      status: newsletterSubscribers.status,
    })
    .from(campaignRecipients)
    .innerJoin(newsletterSubscribers, eq(campaignRecipients.subscriberId, newsletterSubscribers.id))
    .where(and(eq(campaignRecipients.campaignId, campaignId), eq(campaignRecipients.status, "queued")))
    .limit(batchSize);

  const html = renderMarkdown(campaign.body);
  let sent = 0;
  let failed = 0;
  for (const r of batch) {
    if (r.status !== "subscribed") {
      await db
        .update(campaignRecipients)
        .set({ status: "failed", error: "Unsubscribed before sending" })
        .where(and(eq(campaignRecipients.campaignId, campaignId), eq(campaignRecipients.subscriberId, r.subscriberId)));
      continue;
    }
    const result = await sendEmail({
      to: r.email,
      subject: campaign.subject,
      template: `campaign:${campaign.id}`,
      react: createElement(NewsletterCampaignEmail, {
        subject: campaign.subject,
        html,
        unsubscribeUrl: appUrl(`/newsletter/unsubscribe?token=${r.token}`),
      }),
    });
    await db
      .update(campaignRecipients)
      .set(result.ok ? { status: "sent", sentAt: new Date() } : { status: "failed", error: result.error })
      .where(and(eq(campaignRecipients.campaignId, campaignId), eq(campaignRecipients.subscriberId, r.subscriberId)));
    if (result.ok) sent++;
    else failed++;
  }

  const [{ remaining }] = await db
    .select({ remaining: sql<number>`count(*)::int` })
    .from(campaignRecipients)
    .where(and(eq(campaignRecipients.campaignId, campaignId), eq(campaignRecipients.status, "queued")));

  await db
    .update(newsletterCampaigns)
    .set({
      sentCount: sql`${newsletterCampaigns.sentCount} + ${sent}`,
      failedCount: sql`${newsletterCampaigns.failedCount} + ${failed}`,
      ...(remaining === 0 ? { status: "sent" as const, sentAt: new Date() } : {}),
    })
    .where(eq(newsletterCampaigns.id, campaignId));

  return { done: remaining === 0, sent, failed, remaining };
}
