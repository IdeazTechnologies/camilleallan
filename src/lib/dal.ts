import "server-only";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import { cache } from "react";
import { auth } from "@/auth";
import type { Role } from "@/db/schema";

export type CurrentUser = { id: string; email: string; name: string | null; role: Role };

/** Reads the session once per request. Callers must render inside a Suspense boundary. */
export const getCurrentUser = cache(async (): Promise<CurrentUser | null> => {
  // Auth.js and new pg connections generate random bytes synchronously, which must happen at request time.
  await connection();
  const session = await auth();
  if (!session?.user?.id || !session.user.email) return null;
  return {
    id: session.user.id,
    email: session.user.email,
    name: session.user.name ?? null,
    role: session.user.role,
  };
});

export async function requireUser(next = "/account"): Promise<CurrentUser> {
  const user = await getCurrentUser();
  if (!user) redirect(`/login?next=${encodeURIComponent(next)}`);
  return user;
}

/** Use in every admin page and server action; the proxy only checks that a session cookie exists. */
export async function requireAdmin(): Promise<CurrentUser> {
  const user = await getCurrentUser();
  if (!user) redirect("/login?next=/admin");
  if (user.role !== "admin") redirect("/account?notice=admin-only");
  return user;
}
