import { desc, eq } from "drizzle-orm";
import type { Metadata } from "next";
import Link from "next/link";
import { AdminHeader, Empty } from "@/components/admin/ui";
import { db } from "@/db";
import { emailLog } from "@/db/schema";
import { requireAdmin } from "@/lib/dal";
import { emailTransport } from "@/lib/email/send";
import { formatDate } from "@/lib/utils";

export const metadata: Metadata = { title: "Email log" };

export default async function AdminEmails({ searchParams }: PageProps<"/admin/emails">) {
  await requireAdmin();
  const params = await searchParams;
  const viewId = typeof params.view === "string" ? params.view : null;
  const [list, viewing] = await Promise.all([
    db.query.emailLog.findMany({
      orderBy: [desc(emailLog.createdAt)],
      limit: 200,
      columns: { id: true, to: true, subject: true, template: true, status: true, error: true, createdAt: true },
    }),
    viewId ? db.query.emailLog.findFirst({ where: eq(emailLog.id, viewId) }) : null,
  ]);
  const transport = emailTransport();

  return (
    <>
      <AdminHeader
        title="Email log"
        description={
          transport === "outbox"
            ? "Emails are being stored here instead of sent (outbox mode). Configure the Ideaz API to send real email."
            : "Recent emails sent through the Ideaz API."
        }
      />
      {viewing && (
        <section className="card stack" style={{ marginBottom: "var(--space-5)" }}>
          <div className="spread">
            <strong>{viewing.subject}</strong>
            <Link href="/admin/emails">Close</Link>
          </div>
          <span className="muted">To {viewing.to}</span>
          {viewing.html ? (
            <iframe title="Email preview" srcDoc={viewing.html} sandbox="" style={{ width: "100%", height: 600, border: "1px solid var(--color-border)", borderRadius: 8, background: "#fff" }} />
          ) : (
            <p className="muted">The message body is only kept in outbox mode.</p>
          )}
        </section>
      )}
      {list.length === 0 ? (
        <Empty>No emails yet.</Empty>
      ) : (
        <div className="card table-wrap" style={{ padding: 0 }}>
          <table className="table">
            <thead>
              <tr>
                <th>When</th>
                <th>To</th>
                <th>Subject</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {list.map((e) => (
                <tr key={e.id}>
                  <td className="nowrap">{formatDate(e.createdAt, true)}</td>
                  <td>{e.to}</td>
                  <td>
                    <Link href={`/admin/emails?view=${e.id}`}>{e.subject}</Link>
                    <div className="muted">{e.template}</div>
                  </td>
                  <td>
                    <span className={`badge ${e.status === "sent" ? "success" : e.status === "failed" ? "danger" : ""}`} title={e.error ?? undefined}>
                      {e.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
