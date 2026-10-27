"use server";

import { z } from "zod";
import { checkBot } from "@/lib/bot-protection";
import type { ActionState } from "@/lib/forms";
import { requestSubscription } from "@/lib/newsletter";
import { clientIp, rateLimit } from "@/lib/rate-limit";

const schema = z.object({ email: z.email("Please enter a valid email address.") });

export async function subscribeAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const parsed = schema.safeParse({ email: String(formData.get("email") ?? "").trim() });
  if (!parsed.success) return { ok: false, message: parsed.error.issues[0].message };

  const ip = await clientIp();
  const bot = await checkBot(formData, ip);
  if (bot) return { ok: false, message: bot };
  if (!(await rateLimit(`newsletter:${ip}`, 5, 60 * 60))) {
    return { ok: false, message: "Too many attempts. Please try again later." };
  }

  const result = await requestSubscription(parsed.data.email, String(formData.get("source") ?? "footer"));
  return {
    ok: true,
    message: result.alreadySubscribed
      ? "You're already on the list. Thank you!"
      : "Almost done! Check your inbox to confirm your subscription.",
  };
}
