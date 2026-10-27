"use server";

import { and, eq, ne } from "drizzle-orm";
import { updateTag } from "next/cache";
import { db } from "@/db";
import { pollOptions, polls } from "@/db/schema";
import { audit } from "@/lib/audit";
import { TAGS } from "@/lib/catalog";
import { requireAdmin } from "@/lib/dal";
import type { ActionState } from "@/lib/forms";
import { POLL_PLACEMENTS } from "@/lib/placements";

export async function createPollAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const admin = await requireAdmin();
  const question = String(formData.get("question") ?? "").trim();
  const placement = POLL_PLACEMENTS.find(([p]) => p === formData.get("placement"))?.[0] ?? "home";
  const options = String(formData.get("options") ?? "")
    .split("\n")
    .map((o) => o.trim())
    .filter(Boolean)
    .slice(0, 10);
  if (question.length < 5) return { ok: false, message: "Enter a question." };
  if (options.length < 2) return { ok: false, message: "Enter at least two options, one per line." };
  const closesRaw = String(formData.get("closesAt") ?? "");
  const closesAt = closesRaw ? new Date(closesRaw) : null;

  await db.transaction(async (tx) => {
    // Only one active poll per placement.
    await tx.update(polls).set({ active: false }).where(eq(polls.placement, placement));
    const [poll] = await tx.insert(polls).values({ question, placement, active: true, closesAt }).returning({ id: polls.id });
    await tx.insert(pollOptions).values(options.map((label, i) => ({ pollId: poll.id, label, sortOrder: i })));
    await audit(admin.id, "poll.create", "poll", poll.id, { question });
  });
  updateTag(TAGS.polls);
  return { ok: true, message: "Poll created and activated." };
}

export async function togglePollAction(formData: FormData) {
  const admin = await requireAdmin();
  const id = String(formData.get("id"));
  const poll = await db.query.polls.findFirst({ where: eq(polls.id, id) });
  if (!poll) return;
  await db.transaction(async (tx) => {
    if (!poll.active) await tx.update(polls).set({ active: false }).where(and(eq(polls.placement, poll.placement), ne(polls.id, id)));
    await tx.update(polls).set({ active: !poll.active }).where(eq(polls.id, id));
  });
  await audit(admin.id, "poll.toggle", "poll", id, { active: !poll.active });
  updateTag(TAGS.polls);
}

export async function deletePollAction(formData: FormData) {
  const admin = await requireAdmin();
  const id = String(formData.get("id"));
  await db.delete(polls).where(eq(polls.id, id));
  await audit(admin.id, "poll.delete", "poll", id);
  updateTag(TAGS.polls);
}
