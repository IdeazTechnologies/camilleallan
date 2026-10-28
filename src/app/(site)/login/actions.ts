"use server";

import { eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import { z } from "zod";
import { signOut } from "@/auth";
import { db } from "@/db";
import { sessions, users } from "@/db/schema";
import { clearChallenges, consumeChallenge, issueChallenge } from "@/lib/auth-challenges";
import { checkBot } from "@/lib/bot-protection";
import { zodErrors, str } from "@/lib/forms";
import { PASSWORD_MAX_LENGTH, PASSWORD_MIN_LENGTH, hashPassword, verifyPassword } from "@/lib/password";
import { clientIp, rateLimit } from "@/lib/rate-limit";
import { beginLogin } from "@/lib/session";
import { trustDevice, deviceIsTrusted } from "@/lib/trusted-devices";
import { finalizeNewUser, promoteIfAdmin } from "@/lib/users";
import { isSafeRedirect, normalizeEmail } from "@/lib/utils";
import type { LoginState } from "./types";

const TOO_MANY = "Too many attempts. Please wait a few minutes and try again.";
const CODE_INVALID = "That code is incorrect or has expired. Please request a new one.";

const signupSchema = z
  .object({
    email: z.email("Please enter a valid email address."),
    name: z.string().trim().min(2, "Please tell us what to call you.").max(80),
    password: z
      .string()
      .min(PASSWORD_MIN_LENGTH, "Use at least 8 characters.")
      .max(PASSWORD_MAX_LENGTH, "That password is too long."),
    confirm: z.string(),
  })
  .refine((value) => value.password === value.confirm, {
    path: ["confirm"],
    message: "Those passwords don't match.",
  });

const newPasswordSchema = z
  .object({
    password: z
      .string()
      .min(PASSWORD_MIN_LENGTH, "Use at least 8 characters.")
      .max(PASSWORD_MAX_LENGTH, "That password is too long."),
    confirm: z.string(),
  })
  .refine((value) => value.password === value.confirm, {
    path: ["confirm"],
    message: "Those passwords don't match.",
  });

function readNext(formData: FormData) {
  const next = str(formData, "next");
  return isSafeRedirect(next) ? next : "/account";
}

function readEmail(formData: FormData) {
  const raw = str(formData, "email");
  const parsed = z.email("Please enter a valid email address.").safeParse(normalizeEmail(raw));
  if (!parsed.success) {
    return { ok: false as const, raw, message: parsed.error.issues[0]?.message ?? "Please enter a valid email address." };
  }
  return { ok: true as const, email: parsed.data, raw };
}

async function findUser(email: string) {
  const [user] = await db
    .select({
      id: users.id,
      email: users.email,
      passwordHash: users.passwordHash,
      emailVerified: users.emailVerified,
    })
    .from(users)
    .where(eq(users.email, email))
    .limit(1);
  return user ?? null;
}

async function blocked(key: string, limit: number) {
  const ip = await clientIp();
  const allowed = (await rateLimit(key, limit, 15 * 60)) && (await rateLimit(`auth-ip:${ip}`, 40, 15 * 60));
  return allowed ? null : TOO_MANY;
}

async function botMessage(formData: FormData) {
  return checkBot(formData, await clientIp());
}

function isUniqueViolation(err: unknown) {
  let current: unknown = err;
  for (let i = 0; i < 4 && current && typeof current === "object"; i++) {
    if ("code" in current && (current as { code?: unknown }).code === "23505") return true;
    current = "cause" in current ? (current as { cause?: unknown }).cause : null;
  }
  return false;
}

export async function submitLogin(prev: LoginState, formData: FormData): Promise<LoginState> {
  const intent = str(formData, "intent");
  if (intent === "password") return signInWithPassword(prev, formData);
  if (intent === "signup") return createAccount(prev, formData);
  if (intent === "reset") return requestPasswordReset(prev, formData);
  return continueWithEmail(prev, formData);
}

async function continueWithEmail(_prev: LoginState, formData: FormData): Promise<LoginState> {
  const emailResult = readEmail(formData);
  if (!emailResult.ok) return { ok: false, errors: { email: emailResult.message }, values: { email: emailResult.raw } };
  const { email } = emailResult;

  const bot = await botMessage(formData);
  if (bot) return { ok: false, message: bot, values: { email } };
  const limit = await blocked(`auth-email:${email}`, 10);
  if (limit) return { ok: false, message: limit, values: { email } };

  const user = await findUser(email);
  if (!user) return { ok: true, step: "signup", email };
  return { ok: true, step: "password", email, needsPasswordSetup: !user.passwordHash };
}

export async function signInWithPassword(_prev: LoginState, formData: FormData): Promise<LoginState> {
  const emailResult = readEmail(formData);
  const next = readNext(formData);
  if (!emailResult.ok) return { ok: false, step: "email", errors: { email: emailResult.message } };
  const { email } = emailResult;
  const password = String(formData.get("password") ?? "");
  const back = { step: "password" as const, email, needsPasswordSetup: false };

  if (!password) return { ...back, ok: false, errors: { password: "Please enter your password." } };
  const limit = await blocked(`auth-password:${email}`, 10);
  if (limit) return { ...back, ok: false, message: limit };

  const user = await findUser(email);
  if (!user) return { ok: true, step: "signup", email };
  if (!user.passwordHash) {
    return {
      ...back,
      needsPasswordSetup: true,
      ok: false,
      message: "This account doesn't have a password yet. We'll email you a link to create one.",
    };
  }
  if (!(await verifyPassword(password, user.passwordHash))) {
    return { ...back, ok: false, errors: { password: "That password doesn't match. Try again, or reset it below." } };
  }

  if (await deviceIsTrusted(user.id)) {
    await promoteIfAdmin(user.id, email);
    await clearChallenges(email);
    return beginLogin(user.id, next);
  }

  const sent = await issueChallenge({ purpose: "login", email, next, payload: { userId: user.id } });
  if (!sent.ok) return { ...back, ok: false, message: sent.message };
  redirect(`/login/verify?${new URLSearchParams({ purpose: "login", email, next })}`);
}

export async function createAccount(_prev: LoginState, formData: FormData): Promise<LoginState> {
  const next = readNext(formData);
  const raw = {
    email: normalizeEmail(str(formData, "email")),
    name: str(formData, "name"),
    password: String(formData.get("password") ?? ""),
    confirm: String(formData.get("confirm") ?? ""),
  };
  const values = { email: raw.email, name: raw.name };
  const parsed = signupSchema.safeParse(raw);
  if (!parsed.success) {
    return { ok: false, step: "signup", email: raw.email, errors: zodErrors(parsed.error), values, message: "Please check the highlighted fields." };
  }
  const { email, name, password } = parsed.data;

  const bot = await botMessage(formData);
  if (bot) return { ok: false, step: "signup", email, values, message: bot };
  const limit = await blocked(`auth-signup:${email}`, 5);
  if (limit) return { ok: false, step: "signup", email, values, message: limit };

  const existing = await findUser(email);
  if (existing) return { ok: true, step: "password", email, needsPasswordSetup: !existing.passwordHash };

  const sent = await issueChallenge({
    purpose: "signup",
    email,
    next,
    payload: { name, passwordHash: await hashPassword(password) },
  });
  if (!sent.ok) return { ok: false, step: "signup", email, values, message: sent.message };
  redirect(`/login/verify?${new URLSearchParams({ purpose: "signup", email, next })}`);
}

export async function requestPasswordReset(_prev: LoginState, formData: FormData): Promise<LoginState> {
  const emailResult = readEmail(formData);
  const next = readNext(formData);
  if (!emailResult.ok) return { ok: false, step: "email", errors: { email: emailResult.message } };
  const { email } = emailResult;

  const bot = await botMessage(formData);
  if (bot) return { ok: false, step: "password", email, message: bot };
  const limit = await blocked(`auth-reset:${email}`, 5);
  if (limit) return { ok: false, step: "password", email, message: limit };

  const user = await findUser(email);
  if (!user) return { ok: true, step: "signup", email };
  const sent = await issueChallenge({ purpose: "reset", email, next, payload: { userId: user.id } });
  if (!sent.ok) {
    return { ok: false, step: "password", email, needsPasswordSetup: !user.passwordHash, message: sent.message };
  }
  redirect(`/login/reset?${new URLSearchParams({ email, next })}`);
}

export async function verifyCode(_prev: LoginState, formData: FormData): Promise<LoginState> {
  const emailResult = readEmail(formData);
  const next = readNext(formData);
  const purpose = str(formData, "purpose");
  const email = emailResult.ok ? emailResult.email : "";
  if (!emailResult.ok || (purpose !== "login" && purpose !== "signup")) {
    return { ok: false, message: "Please start again from the sign-in page." };
  }
  const limit = await blocked(`auth-code:${purpose}:${email}`, 8);
  if (limit) return { ok: false, message: limit };

  const challenge = await consumeChallenge(purpose, email, str(formData, "code"));
  if (!challenge) return { ok: false, message: CODE_INVALID };

  if (purpose === "login") {
    const user = await findUser(email);
    if (!user) return { ok: false, message: CODE_INVALID };
    await promoteIfAdmin(user.id, email);
    await clearChallenges(email);
    await trustDevice(user.id);
    return beginLogin(user.id, next);
  }

  const name = challenge.payload?.name;
  const passwordHash = challenge.payload?.passwordHash;
  if (!name || !passwordHash) return { ok: false, message: "That signup has expired. Please start again." };

  try {
    const [created] = await db
      .insert(users)
      .values({ name, email, emailVerified: new Date(), passwordHash })
      .returning({ id: users.id });
    await finalizeNewUser(created.id, email);
    await clearChallenges(email);
    await trustDevice(created.id);
    return beginLogin(created.id, next);
  } catch (err) {
    if (isUniqueViolation(err)) {
      return { ok: false, message: "An account for that email already exists. Sign in with your password." };
    }
    throw err;
  }
}

export async function resetPassword(_prev: LoginState, formData: FormData): Promise<LoginState> {
  const emailResult = readEmail(formData);
  const next = readNext(formData);
  if (!emailResult.ok) return { ok: false, message: "Please start again from the sign-in page." };
  const { email } = emailResult;
  const parsed = newPasswordSchema.safeParse({
    password: String(formData.get("password") ?? ""),
    confirm: String(formData.get("confirm") ?? ""),
  });
  if (!parsed.success) {
    return { ok: false, errors: zodErrors(parsed.error), message: "Please check the highlighted fields." };
  }
  const limit = await blocked(`auth-reset-submit:${email}`, 8);
  if (limit) return { ok: false, message: limit };

  const challenge = await consumeChallenge("reset", email, str(formData, "code"));
  if (!challenge) return { ok: false, message: CODE_INVALID };
  const user = await findUser(email);
  if (!user) return { ok: false, message: "We couldn't find that account. Please sign up instead." };

  await db
    .update(users)
    .set({ passwordHash: await hashPassword(parsed.data.password), emailVerified: user.emailVerified ?? new Date() })
    .where(eq(users.id, user.id));
  await db.delete(sessions).where(eq(sessions.userId, user.id));
  await promoteIfAdmin(user.id, email);
  await clearChallenges(email);
  await trustDevice(user.id);
  return beginLogin(user.id, next);
}

export async function signOutAction() {
  await signOut({ redirectTo: "/" });
}
