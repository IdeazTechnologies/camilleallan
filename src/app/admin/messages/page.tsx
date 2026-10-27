import { desc, eq, ne } from "drizzle-orm";
import type { Metadata } from "next";
import Link from "next/link";
import { ConfirmButton } from "@/components/admin/ConfirmButton";
import { AdminHeader, Empty } from "@/components/admin/ui";
import { db } from "@/db";
import { contactMessages } from "@/db/schema";
import { requireAdmin } from "@/lib/dal";
import { formatDate } from "@/lib/utils";
import { deleteMessageAction, setMessageStatusAction } from "./actions";

export const metadata: Metadata = { title: "Messages" };

export default async function AdminMessages({ searchParams }: PageProps<"/admin/messages">) {
  await requireAdmin();
  const params = await searchParams;
  const archived = params.view === "archived";
  const list = await db.query.contactMessages.findMany({
    where: archived ? eq(contactMessages.status, "archived") : ne(contactMessages.status, "archived"),
    orderBy: [desc(contactMessages.createdAt)],
    limit: 200,
  });

  return (
    <>
      <AdminHeader
        title="Messages"
        description="Contact form and custom order requests."
        actions={
          <Link href={archived ? "/admin/messages" : "/admin/messages?view=archived"} className="btn btn-outline btn-sm">
            {archived ? "Inbox" : "Archived"}
          </Link>
        }
      />
      {list.length === 0 ? (
        <Empty>{archived ? "No archived messages." : "No messages. 🎉"}</Empty>
      ) : (
        <div className="stack">
          {list.map((m) => (
            <article key={m.id} className="card stack stack-sm" style={{ borderLeft: m.status === "new" ? "4px solid var(--color-accent)" : undefined }}>
              <div className="spread">
                <div>
                  <strong>{m.name}</strong> · <a href={`mailto:${m.email}?subject=${encodeURIComponent(`Re: ${m.subject ?? "Your message"}`)}`}>{m.email}</a>
                  {m.phone && <span className="muted"> · {m.phone}</span>}
                </div>
                <div className="cluster">
                  {m.kind === "custom_order" && <span className="badge accent">Custom order</span>}
                  {m.status === "new" && <span className="badge warning">New</span>}
                  <span className="muted" style={{ fontSize: "var(--step--1)" }}>
                    {formatDate(m.createdAt, true)}
                  </span>
                </div>
              </div>
              {m.subject && <strong style={{ fontWeight: 500 }}>{m.subject}</strong>}
              <p style={{ whiteSpace: "pre-wrap" }}>{m.message}</p>
              <div className="cluster">
                {m.status === "new" && (
                  <form action={setMessageStatusAction}>
                    <input type="hidden" name="id" value={m.id} />
                    <button className="btn btn-outline btn-sm" name="status" value="read">
                      Mark read
                    </button>
                  </form>
                )}
                <form action={setMessageStatusAction}>
                  <input type="hidden" name="id" value={m.id} />
                  <button className="btn btn-ghost btn-sm" name="status" value={archived ? "read" : "archived"}>
                    {archived ? "Restore" : "Archive"}
                  </button>
                </form>
                <form action={deleteMessageAction}>
                  <input type="hidden" name="id" value={m.id} />
                  <ConfirmButton message="Delete this message permanently?" className="btn-ghost" style={{ color: "var(--color-danger)" }}>
                    Delete
                  </ConfirmButton>
                </form>
              </div>
            </article>
          ))}
        </div>
      )}
    </>
  );
}
