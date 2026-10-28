import "server-only";
import { randomInt } from "node:crypto";
import { and, eq, gt } from "drizzle-orm";
import { createElement } from "react";
import { db } from "@/db";
import { authChallenges, type AuthChallengePayload, type AuthChallengePurpose } from "@/db/schema";
import SecurityCodeEmail from "@/emails/SecurityCodeEmail";
import { hashAuthCode } from "@/lib/auth-code";
import { sendEmail } from "@/lib/email/send";
import { publicUrl } from "@/lib/request";

const CODE_TTL_MS = 15 * 60 * 1000;

const COPY: Record<AuthChallengePurpose, { subject: string; heading: string; body: string; button: string }> = {
  login: {
    subject: "Confirm it's you",
    heading: "Confirm it's you",
    body: "You're signing in from a browser we haven't seen before. Enter this code to finish signing in.",
    button: "Enter the code",
  },
  signup: {
    subject: "Confirm your email",
    heading: "Confirm your email",
    body: "Enter this code to finish creating your Camille Allen account.",
    button: "Confirm your email",
  },
  reset: {
    subject: "Reset your password",
    heading: "Choose a new password",
    body: "Enter this code to set a new password for your Camille Allen account.",
    button: "Choose a new password",
  },
};

export async function issueChallenge(input: {
  purpose: AuthChallengePurpose;
  email: string;
  next: string;
  payload?: AuthChallengePayload;
}): Promise<{ ok: true } | { ok: false; message: string }> {
  const code = randomInt(0, 1_000_000).toString().padStart(6, "0");
  const codeHash = hashAuthCode(input.purpose, input.email, code);
  const expiresAt = new Date(Date.now() + CODE_TTL_MS);
  await db
    .delete(authChallenges)
    .where(and(eq(authChallenges.email, input.email), eq(authChallenges.purpose, input.purpose)));
  await db.insert(authChallenges).values({
    purpose: input.purpose,
    email: input.email,
    codeHash,
    payload: input.payload,
    expiresAt,
  });

  const copy = COPY[input.purpose];
  const path = input.purpose === "reset" ? "/login/reset" : "/login/verify";
  const params = new URLSearchParams({
    email: input.email,
    token: code,
    next: input.next,
  });
  if (input.purpose !== "reset") params.set("purpose", input.purpose);
  const url = await publicUrl(`${path}?${params}`);
  const result = await sendEmail({
    to: input.email,
    subject: `${copy.subject}: ${code}`,
    template: `auth-${input.purpose}`,
    react: createElement(SecurityCodeEmail, {
      url,
      code,
      heading: copy.heading,
      body: copy.body,
      buttonLabel: copy.button,
    }),
  });
  if (!result.ok) {
    await db
      .delete(authChallenges)
      .where(and(eq(authChallenges.email, input.email), eq(authChallenges.codeHash, codeHash)));
    return { ok: false, message: "We couldn't send the email. Please try again shortly." };
  }
  return { ok: true };
}

/** Deletes the matching unexpired code and returns its payload. Wrong or old codes are left unused. */
export async function consumeChallenge(purpose: AuthChallengePurpose, email: string, code: string) {
  const normalized = code.replace(/\D/g, "");
  if (!/^\d{6}$/.test(normalized)) return null;
  const [row] = await db
    .delete(authChallenges)
    .where(
      and(
        eq(authChallenges.purpose, purpose),
        eq(authChallenges.email, email),
        eq(authChallenges.codeHash, hashAuthCode(purpose, email, normalized)),
        gt(authChallenges.expiresAt, new Date()),
      ),
    )
    .returning();
  return row ?? null;
}

export async function clearChallenges(email: string) {
  await db.delete(authChallenges).where(eq(authChallenges.email, email));
}
