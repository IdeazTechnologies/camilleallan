"use server";

import { and, eq } from "drizzle-orm";
import { refresh } from "next/cache";
import { z } from "zod";
import { db } from "@/db";
import { addresses, savedCards, users } from "@/db/schema";
import { parseAddress } from "@/lib/address";
import { issueChallenge } from "@/lib/auth-challenges";
import { requireUser } from "@/lib/dal";
import { checkbox, formValues, zodErrors, type ActionState } from "@/lib/forms";
import { setSubscriptionForUser } from "@/lib/newsletter";
import { clientIp, rateLimit } from "@/lib/rate-limit";

const profileSchema = z.object({
  name: z.string().trim().max(100),
  phone: z.string().trim().max(32),
});

export async function updateProfileAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const user = await requireUser();
  const parsed = profileSchema.safeParse({ name: formData.get("name") ?? "", phone: formData.get("phone") ?? "" });
  if (!parsed.success) return { ok: false, errors: zodErrors(parsed.error), values: formValues(formData) };
  await db
    .update(users)
    .set({ name: parsed.data.name || null, phone: parsed.data.phone || null })
    .where(eq(users.id, user.id));
  await setSubscriptionForUser(user.id, user.email, checkbox(formData, "newsletter"));
  refresh();
  return { ok: true, message: "Your details have been saved." };
}

export async function sendPasswordResetAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  if (String(formData.get("website") ?? "") !== "") return { ok: false, message: "Submission rejected." };
  const user = await requireUser("/account");
  const ip = await clientIp();
  const allowed =
    (await rateLimit(`auth-reset:${user.email}`, 5, 15 * 60)) && (await rateLimit(`auth-ip:${ip}`, 40, 15 * 60));
  if (!allowed) return { ok: false, message: "Too many attempts. Please wait a few minutes and try again." };
  const sent = await issueChallenge({ purpose: "reset", email: user.email, next: "/account", payload: { userId: user.id } });
  if (!sent.ok) return { ok: false, message: sent.message };
  return { ok: true, message: `We sent a link to ${user.email}. It expires in 15 minutes.` };
}

export async function addAddressAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const user = await requireUser("/account/addresses");
  const parsed = parseAddress(formData);
  if (!parsed.success) return { ok: false, errors: zodErrors(parsed.error), values: formValues(formData), message: "Please check the highlighted fields." };
  const makeDefault = checkbox(formData, "isDefault");
  const existing = await db.query.addresses.findFirst({ where: eq(addresses.userId, user.id) });
  await db.transaction(async (tx) => {
    if (makeDefault) await tx.update(addresses).set({ isDefault: false }).where(eq(addresses.userId, user.id));
    await tx.insert(addresses).values({ userId: user.id, ...parsed.data, isDefault: makeDefault || !existing });
  });
  refresh();
  return { ok: true, message: "Address added." };
}

export async function deleteAddressAction(formData: FormData) {
  const user = await requireUser("/account/addresses");
  await db.delete(addresses).where(and(eq(addresses.id, String(formData.get("id"))), eq(addresses.userId, user.id)));
  refresh();
}

export async function setDefaultAddressAction(formData: FormData) {
  const user = await requireUser("/account/addresses");
  const id = String(formData.get("id"));
  await db.transaction(async (tx) => {
    await tx.update(addresses).set({ isDefault: false }).where(eq(addresses.userId, user.id));
    await tx.update(addresses).set({ isDefault: true }).where(and(eq(addresses.id, id), eq(addresses.userId, user.id)));
  });
  refresh();
}

export async function deleteSavedCardAction(formData: FormData) {
  const user = await requireUser("/account/cards");
  await db.delete(savedCards).where(and(eq(savedCards.id, String(formData.get("id"))), eq(savedCards.userId, user.id)));
  refresh();
}
