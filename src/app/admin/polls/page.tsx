import { asc, desc, sql } from "drizzle-orm";
import type { Metadata } from "next";
import { ConfirmButton } from "@/components/admin/ConfirmButton";
import { AdminHeader } from "@/components/admin/ui";
import { db } from "@/db";
import { pollOptions, polls, pollVotes } from "@/db/schema";
import { requireAdmin } from "@/lib/dal";
import { POLL_PLACEMENTS } from "@/lib/placements";
import { formatDate } from "@/lib/utils";
import { deletePollAction, togglePollAction } from "./actions";
import { PollCreateForm } from "./PollCreateForm";

export const metadata: Metadata = { title: "Polls" };

export default async function AdminPolls() {
  await requireAdmin();
  const [list, counts] = await Promise.all([
    db.query.polls.findMany({ orderBy: [desc(polls.createdAt)], with: { options: { orderBy: [asc(pollOptions.sortOrder)] } } }),
    db
      .select({ optionId: pollVotes.optionId, n: sql<number>`count(*)::int` })
      .from(pollVotes)
      .groupBy(pollVotes.optionId),
  ]);
  const votes = new Map(counts.map((c) => [c.optionId, c.n]));
  const label = Object.fromEntries(POLL_PLACEMENTS);

  return (
    <>
      <AdminHeader title="Polls" description="Ask visitors a quick question. One poll can be active per page." />
      <div className="split">
        <div className="stack">
          {list.length === 0 && <p className="card muted">No polls yet.</p>}
          {list.map((p) => {
            const total = p.options.reduce((n, o) => n + (votes.get(o.id) ?? 0), 0);
            return (
              <section key={p.id} className="card stack stack-sm">
                <div className="spread">
                  <strong>{p.question}</strong>
                  <span className={`badge ${p.active ? "success" : ""}`}>{p.active ? `Active · ${label[p.placement]}` : "Inactive"}</span>
                </div>
                <ul className="stack stack-sm" style={{ listStyle: "none", padding: 0 }}>
                  {p.options.map((o) => {
                    const n = votes.get(o.id) ?? 0;
                    const pct = total ? Math.round((n / total) * 100) : 0;
                    return (
                      <li key={o.id}>
                        <div className="spread" style={{ fontSize: "var(--step--1)" }}>
                          <span>{o.label}</span>
                          <span className="muted">
                            {n} ({pct}%)
                          </span>
                        </div>
                        <div style={{ height: 6, background: "var(--color-surface-strong)", borderRadius: 99 }}>
                          <div style={{ width: `${pct}%`, height: "100%", background: "var(--color-accent)", borderRadius: 99 }} />
                        </div>
                      </li>
                    );
                  })}
                </ul>
                <div className="spread">
                  <span className="muted" style={{ fontSize: "var(--step--1)" }}>
                    {total} vote{total === 1 ? "" : "s"} · created {formatDate(p.createdAt)}
                    {p.closesAt ? ` · closes ${formatDate(p.closesAt, true)}` : ""}
                  </span>
                  <div className="cluster">
                    <form action={togglePollAction}>
                      <input type="hidden" name="id" value={p.id} />
                      <button className="btn btn-outline btn-sm" type="submit">
                        {p.active ? "Deactivate" : "Activate"}
                      </button>
                    </form>
                    <form action={deletePollAction}>
                      <input type="hidden" name="id" value={p.id} />
                      <ConfirmButton message="Delete this poll and its votes?" className="btn-ghost" style={{ color: "var(--color-danger)" }}>
                        Delete
                      </ConfirmButton>
                    </form>
                  </div>
                </div>
              </section>
            );
          })}
        </div>
        <section className="card stack">
          <h2 style={{ fontSize: "var(--step-1)" }}>New poll</h2>
          <PollCreateForm placements={POLL_PLACEMENTS} />
        </section>
      </div>
    </>
  );
}
