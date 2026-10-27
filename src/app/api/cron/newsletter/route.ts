import { eq } from "drizzle-orm";
import { NextResponse, type NextRequest } from "next/server";
import { db } from "@/db";
import { newsletterCampaigns } from "@/db/schema";
import { isAuthorizedCron } from "@/lib/cron";
import { processCampaignBatch } from "@/lib/newsletter";

export const maxDuration = 300;

/** Finishes any campaign whose admin tab was closed mid-send. */
export async function GET(request: NextRequest) {
  if (!isAuthorizedCron(request)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const sending = await db.query.newsletterCampaigns.findMany({ where: eq(newsletterCampaigns.status, "sending") });
  const deadline = Date.now() + 240_000;
  const results: Record<string, { sent: number; failed: number; remaining: number }> = {};
  for (const campaign of sending) {
    let totals = { sent: 0, failed: 0, remaining: 0 };
    while (Date.now() < deadline) {
      const r = await processCampaignBatch(campaign.id, 50);
      totals = { sent: totals.sent + r.sent, failed: totals.failed + r.failed, remaining: r.remaining };
      if (r.done) break;
    }
    results[campaign.id] = totals;
  }
  return NextResponse.json({ campaigns: results });
}
