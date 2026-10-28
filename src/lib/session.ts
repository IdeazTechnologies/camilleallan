import "server-only";
import { randomBytes } from "node:crypto";
import { eq } from "drizzle-orm";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { db } from "@/db";
import { sessions, users } from "@/db/schema";
import { requestIsSecure } from "@/lib/request";

/** Sign-in cookie lifetime. Auth.js does not extend it: updateAge matches maxAge. */
export const SESSION_MAX_AGE_SECONDS = 60 * 60 * 24;

export async function startSession(userId: string) {
  const sessionToken = randomBytes(32).toString("hex");
  const expires = new Date(Date.now() + SESSION_MAX_AGE_SECONDS * 1000);
  await db.insert(sessions).values({ sessionToken, userId, expires });
  const secure = await requestIsSecure();
  const jar = await cookies();
  jar.set(secure ? "__Secure-authjs.session-token" : "authjs.session-token", sessionToken, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    secure,
    expires,
  });
}

export async function beginLogin(userId: string, next: string): Promise<never> {
  await startSession(userId);
  const [user] = await db.select({ role: users.role }).from(users).where(eq(users.id, userId)).limit(1);
  redirect(next === "/account" && user?.role === "admin" ? "/admin" : next);
}
