import "server-only";
import { randomBytes } from "node:crypto";
import { and, eq, lt } from "drizzle-orm";
import { cookies } from "next/headers";
import { db } from "@/db";
import { trustedDevices } from "@/db/schema";
import { DEVICE_COOKIE, DEVICE_MAX_AGE_SECONDS, hashDeviceToken, isDeviceToken } from "@/lib/device-token";
import { requestIsSecure } from "@/lib/request";

const STALE_AFTER_MS = DEVICE_MAX_AGE_SECONDS * 1000;

async function readDeviceToken() {
  const jar = await cookies();
  const value = jar.get(DEVICE_COOKIE)?.value;
  return isDeviceToken(value) ? value : null;
}

/** True when this browser has already completed a second check for the user. */
export async function deviceIsTrusted(userId: string) {
  const token = await readDeviceToken();
  if (!token) return false;
  const tokenHash = hashDeviceToken(token);
  const [row] = await db
    .select({ id: trustedDevices.id })
    .from(trustedDevices)
    .where(and(eq(trustedDevices.userId, userId), eq(trustedDevices.tokenHash, tokenHash)))
    .limit(1);
  if (!row) return false;
  await db.update(trustedDevices).set({ lastUsedAt: new Date() }).where(eq(trustedDevices.id, row.id));
  return true;
}

/** Remember this browser for the user so the next sign-in can skip the email code. */
export async function trustDevice(userId: string) {
  const jar = await cookies();
  let token = await readDeviceToken();
  if (!token) {
    token = randomBytes(32).toString("hex");
    const secure = await requestIsSecure();
    jar.set(DEVICE_COOKIE, token, {
      httpOnly: true,
      sameSite: "lax",
      path: "/",
      secure,
      maxAge: DEVICE_MAX_AGE_SECONDS,
    });
  }
  const tokenHash = hashDeviceToken(token);
  const [existing] = await db
    .select({ id: trustedDevices.id })
    .from(trustedDevices)
    .where(and(eq(trustedDevices.userId, userId), eq(trustedDevices.tokenHash, tokenHash)))
    .limit(1);
  if (existing) {
    await db.update(trustedDevices).set({ lastUsedAt: new Date() }).where(eq(trustedDevices.id, existing.id));
  } else {
    await db.insert(trustedDevices).values({ userId, tokenHash });
  }
  await db
    .delete(trustedDevices)
    .where(and(eq(trustedDevices.userId, userId), lt(trustedDevices.lastUsedAt, new Date(Date.now() - STALE_AFTER_MS))));
}
