import { and, desc, eq, ilike, sql, type SQL } from "drizzle-orm";
import type { Metadata } from "next";
import Link from "next/link";
import { AdminHeader, Pagination } from "@/components/admin/ui";
import { db } from "@/db";
import { newsletterCampaigns, newsletterSubscribers } from "@/db/schema";
import { requireAdmin } from "@/lib/dal";
import { formatDate } from "@/lib/utils";
import { setSubscriberStatusAction } from "./actions";
import { AddSubscribersForm, CampaignForm } from "./NewsletterForms";

export const metadata: Metadata = { title: "Newsletter" };
const PAGE_SIZE = 50;
const STATUSES = ["subscribed", "pending", "unsubscribed"] as const;

export default async function AdminNewsletter({ searchParams }: PageProps<"/admin/newsletter">) {
  await requireAdmin();
  const params = await searchParams;
  const q = typeof params.q === "string" ? params.q.trim() : "";
  const status = STATUSES.find((s) => s === params.status) ?? "subscribed";
  const page = Math.max(1, Number(params.page) || 1);
  const filters: SQL[] = [eq(newsletterSubscribers.status, status)];
  if (q) filters.push(ilike(newsletterSubscribers.email, `%${q}%`));

  const [campaigns, subscribers, counts] = await Promise.all([
    db.query.newsletterCampaigns.findMany({ orderBy: [desc(newsletterCampaigns.createdAt)], limit: 20 }),
    db.query.newsletterSubscribers.findMany({
      where: and(...filters),
      orderBy: [desc(newsletterSubscribers.createdAt)],
      limit: PAGE_SIZE,
      offset: (page - 1) * PAGE_SIZE,
    }),
    db
      .select({ status: newsletterSubscribers.status, n: sql<number>`count(*)::int` })
      .from(newsletterSubscribers)
      .groupBy(newsletterSubscribers.status),
  ]);
  const count = (s: string) => counts.find((c) => c.status === s)?.n ?? 0;

  return (
    <>
      <AdminHeader
        title="Newsletter"
        description={`${count("subscribed")} subscribed · ${count("pending")} awaiting confirmation · ${count("unsubscribed")} unsubscribed`}
        actions={
          <a href="/api/admin/subscribers-export" download className="btn btn-outline btn-sm">
            Export CSV
          </a>
        }
      />
      <div className="split">
        <section className="stack stack-lg">
          <div className="card stack">
            <h2 style={{ fontSize: "var(--step-1)" }}>Campaigns</h2>
            {campaigns.length === 0 ? (
              <p className="muted">No campaigns yet.</p>
            ) : (
              <table className="table">
                <tbody>
                  {campaigns.map((c) => (
                    <tr key={c.id}>
                      <td>
                        <Link href={`/admin/newsletter/${c.id}`}>{c.subject}</Link>
                      </td>
                      <td>
                        <span className={`badge ${c.status === "sent" ? "success" : c.status === "sending" ? "warning" : ""}`}>{c.status}</span>
                      </td>
                      <td className="muted">{c.sentAt ? `${c.sentCount} sent ${formatDate(c.sentAt)}` : formatDate(c.createdAt)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
            <details>
              <summary className="btn btn-sm" style={{ display: "inline-flex" }}>
                New campaign
              </summary>
              <div style={{ marginTop: "var(--space-4)" }}>
                <CampaignForm />
              </div>
            </details>
          </div>

          <div className="card stack">
            <div className="spread">
              <h2 style={{ fontSize: "var(--step-1)" }}>Subscribers</h2>
              <form className="cluster">
                <select className="input" name="status" defaultValue={status} style={{ minHeight: 36, width: "auto" }}>
                  {STATUSES.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
                <input className="input" name="q" placeholder="Search email" defaultValue={q} style={{ minHeight: 36, maxWidth: 200 }} />
                <button className="btn btn-outline btn-sm" type="submit">
                  Filter
                </button>
              </form>
            </div>
            <div className="table-wrap">
              <table className="table">
                <thead>
                  <tr>
                    <th>Email</th>
                    <th>Source</th>
                    <th>Since</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {subscribers.map((s) => (
                    <tr key={s.id}>
                      <td>{s.email}</td>
                      <td className="muted">{s.source ?? ""}</td>
                      <td>{formatDate(s.confirmedAt ?? s.createdAt)}</td>
                      <td className="num">
                        <form action={setSubscriberStatusAction}>
                          <input type="hidden" name="id" value={s.id} />
                          <button className="link-button" name="status" value={s.status === "subscribed" ? "unsubscribed" : "subscribed"} style={{ fontSize: "var(--step--1)" }}>
                            {s.status === "subscribed" ? "Unsubscribe" : "Resubscribe"}
                          </button>
                        </form>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <Pagination
              page={page}
              pageCount={Math.ceil(count(status) / PAGE_SIZE)}
              makeHref={(p) => `/admin/newsletter?${new URLSearchParams({ status, ...(q ? { q } : {}), page: String(p) })}`}
            />
          </div>
        </section>
        <aside className="card stack">
          <h2 style={{ fontSize: "var(--step-1)" }}>Add subscribers</h2>
          <AddSubscribersForm />
        </aside>
      </div>
    </>
  );
}
