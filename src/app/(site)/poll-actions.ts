"use server";

import { and, eq, sql } from "drizzle-orm";
import { cookies } from "next/headers";
import { db } from "@/db";
import { pollOptions, pollVotes, polls } from "@/db/schema";
import { clientIp, rateLimit } from "@/lib/rate-limit";

export type PollResult = {
  ok: boolean;
  message?: string;
  votedOptionId?: string;
  results?: Array<{ optionId: string; votes: number }>;
  total?: number;
};

const VOTER_COOKIE = "ca_voter";

async function results(pollId: string) {
  const rows = await db
    .select({ optionId: pollOptions.id, votes: sql<number>`count(${pollVotes.id})::int` })
    .from(pollOptions)
    .leftJoin(pollVotes, eq(pollVotes.optionId, pollOptions.id))
    .where(eq(pollOptions.pollId, pollId))
    .groupBy(pollOptions.id);
  return { results: rows, total: rows.reduce((n, r) => n + r.votes, 0) };
}

export async function votePoll(_prev: PollResult, formData: FormData): Promise<PollResult> {
  const pollId = String(formData.get("pollId") ?? "");
  const optionId = String(formData.get("optionId") ?? "");
  if (!optionId) return { ok: false, message: "Please choose an option." };

  const poll = await db.query.polls.findFirst({
    where: and(eq(polls.id, pollId), eq(polls.active, true), sql`(${polls.closesAt} is null or ${polls.closesAt} > now())`),
  });
  if (!poll) return { ok: false, message: "This poll is closed." };
  const option = await db.query.pollOptions.findFirst({
    where: and(eq(pollOptions.id, optionId), eq(pollOptions.pollId, pollId)),
  });
  if (!option) return { ok: false, message: "Please choose an option." };

  if (!(await rateLimit(`poll:${await clientIp()}`, 30, 60 * 60))) {
    return { ok: false, message: "Too many votes from your connection. Please try later." };
  }

  const jar = await cookies();
  let voterKey = jar.get(VOTER_COOKIE)?.value;
  if (!voterKey) {
    voterKey = crypto.randomUUID();
    jar.set(VOTER_COOKIE, voterKey, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      maxAge: 60 * 60 * 24 * 365,
      path: "/",
    });
  }

  const inserted = await db
    .insert(pollVotes)
    .values({ pollId, optionId, voterKey })
    .onConflictDoNothing()
    .returning({ id: pollVotes.id });

  let votedOptionId = optionId;
  if (inserted.length === 0) {
    const prior = await db.query.pollVotes.findFirst({
      where: and(eq(pollVotes.pollId, pollId), eq(pollVotes.voterKey, voterKey)),
    });
    votedOptionId = prior?.optionId ?? optionId;
  }

  return {
    ok: true,
    message: inserted.length ? "Thanks for voting!" : "You've already voted. Here are the results.",
    votedOptionId,
    ...(await results(pollId)),
  };
}
