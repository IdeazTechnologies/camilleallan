"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { signIn, signOut } from "@/auth";
import { checkBot } from "@/lib/bot-protection";
import type { ActionState } from "@/lib/forms";
import { clientIp, rateLimit } from "@/lib/rate-limit";
import { isSafeRedirect, normalizeEmail } from "@/lib/utils";

const emailSchema = z.email("Please enter a valid email address.");

export async function requestLoginCode(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const rawEmail = String(formData.get("email") ?? "");
  const next = String(formData.get("next") ?? "");
  const redirectTo = isSafeRedirect(next) ? next : "/account";
  const parsed = emailSchema.safeParse(normalizeEmail(rawEmail));
  if (!parsed.success) return { ok: false, errors: { email: parsed.error.issues[0].message }, values: { email: rawEmail } };
  const email = parsed.data;

  const ip = await clientIp();
  const bot = await checkBot(formData, ip);
  if (bot) return { ok: false, message: bot, values: { email } };
  const allowed =
    (await rateLimit(`login-request:${email}`, 5, 15 * 60)) && (await rateLimit(`login-request-ip:${ip}`, 20, 15 * 60));
  if (!allowed) {
    return { ok: false, message: "Too many sign-in requests. Please wait a few minutes and try again.", values: { email } };
  }

  try {
    await signIn("email", { email, redirectTo, redirect: false });
  } catch (err) {
    console.error("[login] sending code failed", err);
    return { ok: false, message: "We couldn't send the sign-in email. Please try again shortly.", values: { email } };
  }

  redirect(`/login/check-email?${new URLSearchParams({ email, next: redirectTo })}`);
}

export async function signOutAction() {
  await signOut({ redirectTo: "/" });
}
