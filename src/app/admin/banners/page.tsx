import { asc, desc } from "drizzle-orm";
import type { Metadata } from "next";
import { ConfirmButton } from "@/components/admin/ConfirmButton";
import { AdminHeader } from "@/components/admin/ui";
import { db } from "@/db";
import { banners } from "@/db/schema";
import { requireAdmin } from "@/lib/dal";
import { formatDate } from "@/lib/utils";
import { BANNER_PLACEMENTS as PLACEMENTS } from "@/lib/placements";
import { deleteBannerAction } from "./actions";
import { BannerForm } from "./BannerForm";

export const metadata: Metadata = { title: "Banners" };

export default async function AdminBanners() {
  await requireAdmin();
  const list = await db.query.banners.findMany({ orderBy: [asc(banners.placement), asc(banners.sortOrder), desc(banners.createdAt)] });
  const label = Object.fromEntries(PLACEMENTS);
  return (
    <>
      <AdminHeader title="Banners" description="Announcements shown on the site. Schedule them with start and end times." />
      <div className="stack">
        {list.map((b) => (
          <details key={b.id} className="card">
            <summary className="spread" style={{ cursor: "pointer" }}>
              <span>
                <span className={`badge ${b.tone === "promo" ? "accent" : b.tone === "notice" ? "warning" : ""}`}>{label[b.placement]}</span>{" "}
                <strong>{b.title ?? b.body}</strong>
              </span>
              <span className="muted" style={{ fontSize: "var(--step--1)" }}>
                {!b.active ? "Inactive" : b.endsAt ? `Until ${formatDate(b.endsAt, true)}` : "Active"}
              </span>
            </summary>
            <div className="stack" style={{ marginTop: "var(--space-4)" }}>
              <BannerForm banner={b} placements={PLACEMENTS} />
              <form action={deleteBannerAction}>
                <input type="hidden" name="id" value={b.id} />
                <ConfirmButton message="Delete this banner?" className="btn-ghost" style={{ color: "var(--color-danger)" }}>
                  Delete
                </ConfirmButton>
              </form>
            </div>
          </details>
        ))}
        <div className="card stack">
          <strong>New banner</strong>
          <BannerForm placements={PLACEMENTS} />
        </div>
      </div>
    </>
  );
}
