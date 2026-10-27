import "server-only";
import { render } from "@react-email/render";
import type { ReactElement } from "react";
import { db } from "@/db";
import { emailLog } from "@/db/schema";
import { sendViaIdeaz } from "./ideaz";

export function emailTransport(): "ideaz" | "outbox" {
  const configured = process.env.EMAIL_TRANSPORT;
  if (configured === "outbox" || configured === "ideaz") return configured;
  return process.env.IDEAZ_API_KEY ? "ideaz" : "outbox";
}

export type SendEmailInput = {
  to: string;
  subject: string;
  template: string;
  react: ReactElement;
  replyTo?: string;
};

/** Renders a React Email template and sends it, recording every attempt in email_log. */
export async function sendEmail({ to, subject, template, react, replyTo }: SendEmailInput) {
  const [html, text] = await Promise.all([render(react), render(react, { plainText: true })]);
  const transport = emailTransport();

  if (transport === "outbox") {
    await db.insert(emailLog).values({ to, subject, template, status: "outbox", html, text });
    if (process.env.NODE_ENV !== "production") {
      console.info(`[email:outbox] to=${to} subject="${subject}"\n${text.slice(0, 600)}`);
    }
    return { ok: true as const, id: null };
  }

  const result = await sendViaIdeaz({ to, subject, html, text, replyTo });
  await db.insert(emailLog).values({
    to,
    subject,
    template,
    status: result.ok ? "sent" : "failed",
    providerId: result.ok ? result.id : null,
    error: result.ok ? null : result.error,
  });
  if (!result.ok) console.error(`[email] ${template} to ${to} failed: ${result.error}`);
  return result;
}

export function adminNotifyEmail(fallback: string) {
  return process.env.ADMIN_NOTIFY_EMAIL || fallback;
}
