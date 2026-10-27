import { DrizzleAdapter } from "@auth/drizzle-adapter";
import { and, eq, isNull } from "drizzle-orm";
import NextAuth, { type DefaultSession } from "next-auth";
import type { EmailConfig } from "next-auth/providers/email";
import { randomInt } from "node:crypto";
import { createElement } from "react";
import { getDb } from "@/db";
import { accounts, orders, sessions, users, verificationTokens, type Role } from "@/db/schema";
import LoginEmail from "@/emails/LoginEmail";
import { sendEmail } from "@/lib/email/send";
import { normalizeEmail } from "@/lib/utils";

declare module "next-auth" {
  interface Session {
    user: { id: string; role: Role } & DefaultSession["user"];
  }
  interface User {
    role?: Role;
  }
}

export const LOGIN_CODE_TTL_SECONDS = 15 * 60;

function adminEmails() {
  return (process.env.ADMIN_EMAILS ?? "")
    .split(",")
    .map((e) => normalizeEmail(e))
    .filter(Boolean);
}

async function promoteIfAdmin(userId: string | undefined, email: string | null | undefined) {
  if (!userId || !email || !adminEmails().includes(normalizeEmail(email))) return;
  await getDb().update(users).set({ role: "admin" }).where(eq(users.id, userId));
}

const emailProvider: EmailConfig = {
  id: "email",
  type: "email",
  name: "Email",
  maxAge: LOGIN_CODE_TTL_SECONDS,
  // A 6-digit code doubles as the magic-link token so customers can type it or click the link.
  generateVerificationToken: () => randomInt(0, 1_000_000).toString().padStart(6, "0"),
  normalizeIdentifier: (identifier) => {
    const email = normalizeEmail(identifier);
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error("Invalid email address");
    return email;
  },
  async sendVerificationRequest({ identifier, url, token }) {
    const result = await sendEmail({
      to: identifier,
      subject: `Your Camille Allen sign-in code: ${token}`,
      template: "login",
      react: createElement(LoginEmail, { url, code: token }),
    });
    if (!result.ok) throw new Error("Could not send the sign-in email");
  },
};

export const { handlers, auth, signIn, signOut } = NextAuth(() => {
  const db = getDb();
  return {
    adapter: DrizzleAdapter(db, {
      usersTable: users,
      accountsTable: accounts,
      sessionsTable: sessions,
      verificationTokensTable: verificationTokens,
    }),
    session: { strategy: "database", maxAge: 60 * 60 * 24 * 30, updateAge: 60 * 60 * 24 },
    trustHost: true,
    pages: { signIn: "/login", verifyRequest: "/login/check-email", error: "/login" },
    providers: [emailProvider],
    callbacks: {
      session({ session, user }) {
        session.user.id = user.id;
        session.user.role = (user as { role?: Role }).role ?? "customer";
        return session;
      },
    },
    events: {
      async createUser({ user }) {
        await promoteIfAdmin(user.id, user.email);
        if (user.id && user.email) {
          // Attach earlier guest orders placed with the same email.
          await getDb()
            .update(orders)
            .set({ userId: user.id })
            .where(and(eq(orders.email, normalizeEmail(user.email)), isNull(orders.userId)));
        }
      },
      async signIn({ user }) {
        await promoteIfAdmin(user.id, user.email);
      },
    },
  };
});
