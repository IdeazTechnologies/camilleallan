"use server";

import { createElement } from "react";
import { z } from "zod";
import { db } from "@/db";
import { contactMessages } from "@/db/schema";
import { ContactNotificationEmail } from "@/emails/MiscEmails";
import { checkBot } from "@/lib/bot-protection";
import { adminNotifyEmail, sendEmail } from "@/lib/email/send";
import { formValues, zodErrors, type ActionState } from "@/lib/forms";
import { clientIp, rateLimit } from "@/lib/rate-limit";
import { readSettingsFresh } from "@/lib/settings";
import { publicUrl } from "@/lib/request";
import { normalizeEmail } from "@/lib/utils";

const schema = z.object({
  kind: z.enum(["general", "custom_order"]),
  name: z.string().trim().min(2, "Please enter your name.").max(100),
  email: z.email("Please enter a valid email address."),
  phone: z.string().trim().max(32).optional(),
  subject: z.string().trim().max(150).optional(),
  message: z.string().trim().min(10, "Please write a little more.").max(5000),
});

export async function contactAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const values = formValues(formData);
  const parsed = schema.safeParse({
    kind: values.kind === "custom_order" ? "custom_order" : "general",
    name: values.name ?? "",
    email: normalizeEmail(values.email ?? ""),
    phone: values.phone || undefined,
    subject: values.subject || undefined,
    message: values.message ?? "",
  });
  if (!parsed.success) return { ok: false, errors: zodErrors(parsed.error), values, message: "Please check the highlighted fields." };

  const ip = await clientIp();
  const bot = await checkBot(formData, ip);
  if (bot) return { ok: false, message: bot, values };
  if (!(await rateLimit(`contact:${ip}`, 5, 60 * 60))) {
    return { ok: false, message: "You've sent several messages recently. Please try again later or email us directly.", values };
  }

  const data = parsed.data;
  await db.insert(contactMessages).values({
    kind: data.kind,
    name: data.name,
    email: data.email,
    phone: data.phone ?? null,
    subject: data.subject ?? null,
    message: data.message,
    ip,
  });

  const settings = await readSettingsFresh();
  await sendEmail({
    to: adminNotifyEmail(settings.contactEmail),
    subject: `${data.kind === "custom_order" ? "Custom order request" : "Website message"} from ${data.name}`,
    template: "contact-notification",
    replyTo: data.email,
    react: createElement(ContactNotificationEmail, { ...data, adminUrl: await publicUrl("/admin/messages") }),
  });

  return { ok: true, message: "Thank you! Your message has been sent. Camille will be in touch soon." };
}
