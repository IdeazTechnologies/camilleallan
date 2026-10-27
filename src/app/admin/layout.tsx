import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { signOutAction } from "@/app/(site)/login/actions";
import styles from "./admin.module.css";

export const metadata: Metadata = {
  title: { default: "Admin", template: "%s | Admin" },
  robots: { index: false, follow: false },
};

const NAV: Array<{ group: string; links: Array<[string, string]> }> = [
  { group: "Store", links: [["/admin", "Dashboard"], ["/admin/orders", "Orders"], ["/admin/products", "Products"], ["/admin/categories", "Categories"], ["/admin/customers", "Customers"], ["/admin/shipping", "Shipping"]] },
  { group: "Content", links: [["/admin/gallery", "Gallery"], ["/admin/pages", "Pages"], ["/admin/banners", "Banners"], ["/admin/polls", "Polls"]] },
  { group: "Engage", links: [["/admin/messages", "Messages"], ["/admin/newsletter", "Newsletter"]] },
  { group: "System", links: [["/admin/settings", "Settings"], ["/admin/emails", "Email log"]] },
];

export default function AdminLayout({ children }: LayoutProps<"/admin">) {
  return (
    <div className={styles.shell}>
      <aside className={styles.sidebar}>
        <Link href="/admin" className={styles.brand}>
          Camille Allen
          <small>Store admin</small>
        </Link>
        <nav className={styles.nav} aria-label="Admin">
          {NAV.map((g) => (
            <div key={g.group} style={{ display: "contents" }}>
              <span className={styles.navGroup}>{g.group}</span>
              {g.links.map(([href, label]) => (
                <Link key={href} href={href}>
                  {label}
                </Link>
              ))}
            </div>
          ))}
        </nav>
        <div className={styles.sidebarFooter}>
          <Link href="/" target="_blank">
            View store ↗
          </Link>
          <form action={signOutAction}>
            <button type="submit">Sign out</button>
          </form>
        </div>
      </aside>
      <main className={styles.main} id="main">
        <Suspense fallback={<div className="skeleton" style={{ height: 400 }} />}>{children}</Suspense>
      </main>
    </div>
  );
}
