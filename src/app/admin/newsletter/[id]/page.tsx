import { eq, sql } from "drizzle-orm";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ConfirmButton } from "@/components/admin/ConfirmButton";
import { AdminHeader } from "@/components/admin/ui";
import { db } from "@/db";
import { newsletterCampaigns, newsletterSubscribers } from "@/db/schema";
import { requireAdmin } from "@/lib/dal";
import { formatDate } from "@/lib/utils";
import { deleteCampaignAction } from "../actions";
import { CampaignForm, CampaignSender, CampaignTestForm } from "../NewsletterForms";

export const metadata: Metadata = { title: "Campaign" };

export default async function CampaignPage({ params }: PageProps<"/admin/newsletter/[id]">) {
  const admin = await requireAdmin();
  const { id } = await params;
  const [campaign, [{ n }]] = await Promise.all([
    db.query.newsletterCampaigns.findFirst({ where: eq(newsletterCampaigns.id, id) }),
    db.select({ n: sql<number>`count(*)::int` }).from(newsletterSubscribers).where(eq(newsletterSubscribers.status, "subscribed")),
  ]);
  if (!campaign) notFound();
  const isDraft = campaign.status === "draft";

  return (
    <>
      <AdminHeader
        title={campaign.subject}
        back={{ href: "/admin/newsletter", label: "Newsletter" }}
        description={
          campaign.status === "sent"
            ? `Sent ${formatDate(campaign.sentAt, true)} to ${campaign.sentCount} subscribers${campaign.failedCount ? ` (${campaign.failedCount} failed)` : ""}.`
            : campaign.status === "sending"
              ? `Sending: ${campaign.sentCount} sent so far.`
              : "Draft"
        }
      />
      <div className="split">
        <section className="card">
          <CampaignForm campaign={campaign} readOnly={!isDraft} />
        </section>
        <aside className="stack stack-lg">
          <section className="card stack">
            <h2 style={{ fontSize: "var(--step-1)" }}>Send a test</h2>
            <CampaignTestForm id={campaign.id} defaultTo={admin.email} />
          </section>
          {campaign.status !== "sent" && (
            <section className="card stack">
              <h2 style={{ fontSize: "var(--step-1)" }}>Send</h2>
              <p className="muted" style={{ fontSize: "var(--step--1)" }}>
                Save your draft first. Every email includes an unsubscribe link.
              </p>
              <CampaignSender id={campaign.id} status={campaign.status} subscriberCount={n} />
            </section>
          )}
          {isDraft && (
            <form action={deleteCampaignAction}>
              <input type="hidden" name="id" value={campaign.id} />
              <ConfirmButton message="Delete this draft?" className="btn-ghost" style={{ color: "var(--color-danger)" }}>
                Delete draft
              </ConfirmButton>
            </form>
          )}
        </aside>
      </div>
    </>
  );
}
