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

/**
 * Sends one email through the Ideaz ApiPro email API.
 * The request shape lives only here so it can be adjusted to the ApiPro docs without touching callers.
 */
export async function sendViaIdeaz(message: OutgoingEmail): Promise<SendResult> {
  const url = process.env.IDEAZ_API_URL;
  const key = process.env.IDEAZ_API_KEY;
  if (!url || !key) return { ok: false, error: "IDEAZ_API_URL and IDEAZ_API_KEY must be set" };

  const from = parseFrom(process.env.EMAIL_FROM ?? "Camille Allen <hello@camilleallen.com>");
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
        Authorization: `Bearer ${key}`,
      },
      body: JSON.stringify({
        from: from.email,
        fromName: from.name,
        to: message.to,
        replyTo: message.replyTo,
        subject: message.subject,
        html: message.html,
        text: message.text,
      }),
      signal: AbortSignal.timeout(15_000),
    });
    const body = (await res.json().catch(() => null)) as Record<string, unknown> | null;
    if (!res.ok || body?.success === false) {
      const detail = (body?.error ?? body?.message ?? res.statusText) as string;
      return { ok: false, error: `Ideaz API ${res.status}: ${detail}` };
    }
    const id = (body?.id ?? body?.messageId ?? null) as string | null;
    return { ok: true, id: id == null ? null : String(id) };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}
