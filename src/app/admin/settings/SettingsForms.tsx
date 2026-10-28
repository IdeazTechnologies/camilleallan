"use client";

import { useActionState } from "react";
import { FormMessage } from "@/components/forms/FormMessage";
import { SubmitButton } from "@/components/forms/SubmitButton";
import { initialActionState } from "@/lib/forms";
import { saveFacebookTokenAction, saveInstagramTokenAction, saveSettingsAction, sendTestEmailAction } from "./actions";

type Settings = Record<string, string | number | boolean | string[]>;

export function StoreSettingsForm({ settings }: { settings: Settings }) {
  const [state, action] = useActionState(saveSettingsAction, initialActionState);
  const v = (k: string) => {
    const value = settings[k];
    return Array.isArray(value) ? value.join(", ") : String(value ?? "");
  };
  const text = (k: string, label: string, hint?: string, type = "text") => (
    <div className="field">
      <label htmlFor={k}>{label}</label>
      <input id={k} name={k} type={type} defaultValue={v(k)} />
      {hint && <span className="hint">{hint}</span>}
    </div>
  );

  return (
    <form action={action} className="form">
      <FormMessage state={state} />
      <h3 style={{ fontSize: "var(--step-1)" }}>Store</h3>
      <div className="form-row">
        {text("storeName", "Store name")}
        {text("tagline", "Tagline")}
      </div>
      <div className="form-row">
        {text("contactEmail", "Contact email", "Shown on the site and receives order and message notifications.", "email")}
        {text("contactPhone", "Contact phone")}
        {text("location", "Location")}
      </div>

      <h3 style={{ fontSize: "var(--step-1)" }}>Home page</h3>
      {text("heroTitle", "Hero headline")}
      <div className="field">
        <label htmlFor="heroSubtitle">Hero text</label>
        <textarea id="heroSubtitle" name="heroSubtitle" rows={2} defaultValue={v("heroSubtitle")} />
      </div>
      {text("heroImageUrl", "Hero image URL", "Upload below, or leave blank to use the first featured product photo.")}
      <div className="field">
        <label htmlFor="introText">Artist introduction</label>
        <textarea id="introText" name="introText" rows={3} defaultValue={v("introText")} />
      </div>

      <h3 style={{ fontSize: "var(--step-1)" }}>Checkout</h3>
      <div className="form-row">
        <div className="field">
          <label htmlFor="currency">Currency</label>
          <select id="currency" name="currency" defaultValue={v("currency")}>
            <option value="USD">USD</option>
            <option value="CAD">CAD</option>
          </select>
          <span className="hint">Must match the currency of your PSiGate account.</span>
        </div>
        {text("taxRatePercent", "Tax rate (%)", "0 to disable tax.")}
        {text("taxLabel", "Tax label")}
      </div>
      <label className="check">
        <input type="checkbox" name="taxShipping" defaultChecked={!!settings.taxShipping} />
        Charge tax on shipping
      </label>
      {text("shipToCountries", "Ship only to these countries", "2-letter codes, comma separated. Leave blank to ship worldwide.")}

      <h3 style={{ fontSize: "var(--step-1)" }}>Social &amp; footer</h3>
      <div className="form-row">
        {text("instagramHandle", "Instagram username")}
        {text("facebookUrl", "Facebook page URL", undefined, "url")}
      </div>
      {text("footerText", "Footer text")}
      <div>
        <SubmitButton pendingLabel="Saving…">Save settings</SubmitButton>
      </div>
    </form>
  );
}

export function InstagramForm({ connected, expiresAt }: { connected: boolean; expiresAt: string | null }) {
  const [state, action] = useActionState(saveInstagramTokenAction, initialActionState);
  return (
    <form action={action} className="form">
      <FormMessage state={state} />
      <p className="muted" style={{ fontSize: "var(--step--1)" }}>
        {connected
          ? `Connected${expiresAt ? `; token expires ${new Date(expiresAt).toLocaleDateString()}` : ""}. It is refreshed automatically every week.`
          : "Not connected. The site shows a link to Instagram instead of the photo slideshow."}
      </p>
      <div className="field">
        <label htmlFor="token">Long-lived access token</label>
        <input id="token" name="token" type="password" autoComplete="off" placeholder="IGAA…" />
        <span className="hint">
          From a Meta app using &quot;Instagram API with Instagram Login&quot; for a Business or Creator account.
        </span>
      </div>
      <div className="cluster">
        <SubmitButton className="btn-sm" name="intent" value="save" pendingLabel="Checking…">
          Save token
        </SubmitButton>
        {connected && (
          <button type="submit" name="intent" value="refresh" className="btn btn-outline btn-sm">
            Refresh now
          </button>
        )}
      </div>
    </form>
  );
}

export function FacebookForm({ connected, pageName }: { connected: boolean; pageName: string | null }) {
  const [state, action] = useActionState(saveFacebookTokenAction, initialActionState);
  return (
    <form action={action} className="form">
      <FormMessage state={state} />
      <p className="muted" style={{ fontSize: "var(--step--1)" }}>
        {connected
          ? `Connected${pageName ? ` to ${pageName}` : ""}. Photos from recent Page posts scroll on the home page.`
          : "Not connected. The site shows a link to Facebook instead of the photo slideshow."}
      </p>
      <div className="field">
        <label htmlFor="fbToken">Page access token</label>
        <input id="fbToken" name="token" type="password" autoComplete="off" placeholder="EAA…" />
        <span className="hint">
          A Page token with the pages_read_engagement permission. One made from a long-lived user token does not expire.
        </span>
      </div>
      <div className="cluster">
        <SubmitButton className="btn-sm" name="intent" value="save" pendingLabel="Checking…">
          Save token
        </SubmitButton>
        {connected && (
          <button type="submit" name="intent" value="disconnect" className="btn btn-outline btn-sm">
            Disconnect
          </button>
        )}
      </div>
    </form>
  );
}

export function TestEmailForm({ defaultTo }: { defaultTo: string }) {
  const [state, action] = useActionState(sendTestEmailAction, initialActionState);
  return (
    <form action={action} className="form">
      <FormMessage state={state} />
      <div className="cluster" style={{ flexWrap: "nowrap" }}>
        <input className="input" name="to" type="email" defaultValue={defaultTo} />
        <SubmitButton className="btn-sm" pendingLabel="Sending…">
          Send test
        </SubmitButton>
      </div>
    </form>
  );
}
