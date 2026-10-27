import Link from "next/link";
import type { BannerPlacement } from "@/db/schema";
import { getBanners } from "@/lib/catalog";

export async function Banners({ placement, className }: { placement: BannerPlacement; className?: string }) {
  const banners = await getBanners(placement);
  if (banners.length === 0) return null;
  return (
    <div className={`stack stack-sm ${className ?? ""}`}>
      {banners.map((b) => (
        <aside key={b.id} className={`banner ${b.tone}`} aria-label={b.title ?? "Announcement"}>
          {b.title && <span className="banner-title">{b.title}</span>}
          {b.body && <span className="banner-body">{b.body}</span>}
          {b.linkUrl && (
            <Link href={b.linkUrl} className="banner-link">
              {b.linkLabel || "Learn more"} →
            </Link>
          )}
        </aside>
      ))}
    </div>
  );
}

/** Full-width announcement strip shown above the header. */
export async function SiteTopBanner() {
  const banners = await getBanners("site_top");
  const b = banners[0];
  if (!b) return null;
  return (
    <div
      className={`banner ${b.tone}`}
      style={{ borderRadius: 0, justifyContent: "center", textAlign: "center", fontSize: "var(--step--1)" }}
    >
      {b.title && <strong>{b.title}</strong>}
      {b.body && <span>{b.body}</span>}
      {b.linkUrl && <Link href={b.linkUrl}>{b.linkLabel || "Learn more"} →</Link>}
    </div>
  );
}
