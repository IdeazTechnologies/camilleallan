import "server-only";

export type OutgoingEmail = {
  to: string;
  subject: string;
  html: string;
  text: string;
  replyTo?: string;
};

export type SendResult = { ok: true; id: string | null } | { ok: false; error: string };

function parseFrom(from: string) {
  const match = from.match(/^\s*(.*?)\s*<([^>]+)>\s*$/);
  return match ? { name: match[1], email: match[2] } : { name: "", email: from.trim() };
}

/** Sends one email through the Ideaz email API (api2.ideaz.net, `sendEmail` command). */
export async function sendViaIdeaz(message: OutgoingEmail): Promise<SendResult> {
  const url = process.env.IDEAZ_API_URL || "https://api2.ideaz.net/email/";
  const key = process.env.IDEAZ_API_KEY;
  if (!key) return { ok: false, error: "IDEAZ_API_KEY must be set" };

  const from = parseFrom(process.env.EMAIL_FROM ?? "Camille Allen <camille@camilleallen.com>");
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({
        cmd: "sendEmail",
        Token: key,
        sendTo: [parseFrom(message.to)],
        sendFrom: from,
        ...(message.replyTo ? { replyTo: parseFrom(message.replyTo) } : {}),
        subject: message.subject,
        htmlMessage: message.html,
        txtMessage: message.text,
      }),
      signal: AbortSignal.timeout(15_000),
    });
    const body = (await res.json().catch(() => null)) as Record<string, unknown> | null;
    const apiError = body?.Error ?? body?.error;
    if (!res.ok || body?.success === false || (apiError != null && apiError !== 0 && apiError !== "0")) {
      const detail = String(body?.Message ?? body?.message ?? apiError ?? res.statusText);
      return { ok: false, error: `Ideaz API ${res.status}: ${detail}` };
    }
    const id = (body?.id ?? body?.messageId ?? null) as string | null;
    return { ok: true, id: id == null ? null : String(id) };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}
