import { DrizzleAdapter } from "@auth/drizzle-adapter";
import NextAuth, { type DefaultSession } from "next-auth";
import { getDb } from "@/db";
import { accounts, sessions, users, verificationTokens, type Role } from "@/db/schema";
import { SESSION_MAX_AGE_SECONDS } from "@/lib/session";
import { finalizeNewUser, promoteIfAdmin } from "@/lib/users";

declare module "next-auth" {
  interface Session {
    user: { id: string; role: Role } & DefaultSession["user"];
  }
  interface User {
    role?: Role;
  }
}

export const { handlers, auth, signIn, signOut } = NextAuth(() => {
  const db = getDb();
  return {
    adapter: DrizzleAdapter(db, {
      usersTable: users,
      accountsTable: accounts,
      sessionsTable: sessions,
      verificationTokensTable: verificationTokens,
    }),
    // The session cookie is the login token. updateAge matches maxAge, so a visit does not extend it.
    session: { strategy: "database", maxAge: SESSION_MAX_AGE_SECONDS, updateAge: SESSION_MAX_AGE_SECONDS },
    trustHost: true,
    pages: { signIn: "/login", error: "/login" },
    // Sign-in is handled by our password flow, which writes a row in `sessions` and sets this cookie.
    providers: [],
    callbacks: {
      session({ session, user }) {
        session.user.id = user.id;
        session.user.role = (user as { role?: Role }).role ?? "customer";
        return session;
      },
    },
    events: {
      async createUser({ user }) {
        if (user.id && user.email) await finalizeNewUser(user.id, user.email);
      },
      async signIn({ user }) {
        await promoteIfAdmin(user.id, user.email);
      },
    },
  };
});
