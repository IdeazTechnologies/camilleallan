import { asc } from "drizzle-orm";
import type { Metadata } from "next";
import Link from "next/link";
import { AdminHeader, Empty } from "@/components/admin/ui";
import { db } from "@/db";
import { pages } from "@/db/schema";
import { requireAdmin } from "@/lib/dal";
import { formatDate } from "@/lib/utils";

export const metadata: Metadata = { title: "Pages" };

export default async function AdminPages() {
  await requireAdmin();
  const list = await db.query.pages.findMany({ orderBy: [asc(pages.navOrder), asc(pages.title)] });
  return (
    <>
      <AdminHeader
        title="Pages"
        description="About, FAQ, policies and other content pages."
        actions={
          <Link href="/admin/pages/new" className="btn btn-sm">
            New page
          </Link>
        }
      />
      {list.length === 0 ? (
        <Empty>No pages yet.</Empty>
      ) : (
        <div className="card table-wrap" style={{ padding: 0 }}>
          <table className="table">
            <thead>
              <tr>
                <th>Title</th>
                <th>URL</th>
                <th>Status</th>
                <th>Updated</th>
              </tr>
            </thead>
            <tbody>
              {list.map((p) => (
                <tr key={p.id}>
                  <td>
                    <Link href={`/admin/pages/${p.id}`} style={{ fontWeight: 500 }}>
                      {p.title}
                    </Link>
                    {p.showInNav && <span className="badge accent" style={{ marginLeft: 8 }}>Menu</span>}
                  </td>
                  <td className="muted">/{p.slug}</td>
                  <td>
                    <span className={`badge ${p.published ? "success" : ""}`}>{p.published ? "Published" : "Draft"}</span>
                  </td>
                  <td>{formatDate(p.updatedAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
