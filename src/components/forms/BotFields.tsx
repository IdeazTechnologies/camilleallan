"use client";

import Script from "next/script";
import { useEffect, useRef } from "react";

/** Honeypot, fill-time stamp and (when configured) a Cloudflare Turnstile widget. */
export function BotFields() {
  const startedAt = useRef<HTMLInputElement>(null);
  // Stamped after hydration so prerendered HTML never carries a stale build-time value.
  useEffect(() => {
    if (startedAt.current) startedAt.current.value = String(Date.now());
  }, []);
  const siteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;
  return (
    <>
      <div className="hp-field" aria-hidden="true">
        <label>
          Website
          <input type="text" name="website" tabIndex={-1} autoComplete="off" defaultValue="" />
        </label>
      </div>
      <input type="hidden" name="_ts" ref={startedAt} defaultValue="" />
      {siteKey ? (
        <>
          <Script src="https://challenges.cloudflare.com/turnstile/v0/api.js" async defer />
          <div className="cf-turnstile" data-sitekey={siteKey} />
        </>
      ) : null}
    </>
  );
}
