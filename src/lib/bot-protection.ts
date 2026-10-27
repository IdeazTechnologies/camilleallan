import "server-only";

/**
 * Honeypot + minimum fill time, plus Cloudflare Turnstile when it is configured.
 * Returns an error message, or null when the submission looks human.
 */
export async function checkBot(formData: FormData, ip: string): Promise<string | null> {
  if (String(formData.get("website") ?? "") !== "") return "Submission rejected.";
  const started = Number(formData.get("_ts"));
  if (Number.isFinite(started) && started > 0 && Date.now() - started < 2000) {
    return "That was quick! Please try again.";
  }

  const secret = process.env.TURNSTILE_SECRET_KEY;
  if (!secret) return null;
  const token = String(formData.get("cf-turnstile-response") ?? "");
  if (!token) return "Please complete the verification.";
  const res = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
    method: "POST",
    body: new URLSearchParams({ secret, response: token, remoteip: ip }),
  });
  const data = (await res.json().catch(() => ({}))) as { success?: boolean };
  return data.success ? null : "Verification failed. Please try again.";
}
