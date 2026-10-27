"use client";

import { useActionState } from "react";
import { FormMessage } from "@/components/forms/FormMessage";
import { SubmitButton } from "@/components/forms/SubmitButton";
import { initialActionState } from "@/lib/forms";
import { saveBannerAction } from "./actions";

type Banner = {
  id: string;
  placement: string;
  title: string | null;
  body: string | null;
  linkUrl: string | null;
  linkLabel: string | null;
  tone: string;
  active: boolean;
  startsAt: Date | null;
  endsAt: Date | null;
  sortOrder: number;
};

/** Formats a Date for <input type="datetime-local"> in the browser's local time. */
function local(d: Date | null) {
  if (!d) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function BannerForm({ banner, placements }: { banner?: Banner; placements: Array<[string, string]> }) {
  const [state, action] = useActionState(saveBannerAction, initialActionState);
  return (
    <form
      action={(fd) => {
        // Convert local date inputs to ISO so the server stores the intended instant.
        for (const k of ["startsAt", "endsAt"]) {
          const v = String(fd.get(k) ?? "");
          fd.set(k, v ? new Date(v).toISOString() : "");
        }
        return action(fd);
      }}
      className="form"
    >
      {banner && <input type="hidden" name="id" value={banner.id} />}
      <div className="form-row">
        <div className="field">
          <label>Placement</label>
          <select name="placement" defaultValue={banner?.placement ?? "site_top"}>
            {placements.map(([v, l]) => (
              <option key={v} value={v}>
                {l}
              </option>
            ))}
          </select>
        </div>
        <div className="field">
          <label>Style</label>
          <select name="tone" defaultValue={banner?.tone ?? "info"}>
            <option value="info">Neutral</option>
            <option value="promo">Promotion (rose)</option>
            <option value="notice">Notice (amber)</option>
          </select>
        </div>
        <div className="field">
          <label>Sort order</label>
          <input name="sortOrder" type="number" defaultValue={banner?.sortOrder ?? 0} />
        </div>
      </div>
      <div className="form-row">
        <div className="field">
          <label>Title</label>
          <input name="title" defaultValue={banner?.title ?? ""} placeholder="e.g. Holiday shipping" />
        </div>
        <div className="field">
          <label>Message</label>
          <input name="body" defaultValue={banner?.body ?? ""} placeholder="Order by Dec 10 for delivery before Christmas" />
        </div>
      </div>
      <div className="form-row">
        <div className="field">
          <label>Link URL</label>
          <input name="linkUrl" defaultValue={banner?.linkUrl ?? ""} placeholder="/shop or https://…" />
        </div>
        <div className="field">
          <label>Link label</label>
          <input name="linkLabel" defaultValue={banner?.linkLabel ?? ""} placeholder="Shop now" />
        </div>
        <div className="field">
          <label>Starts</label>
          <input name="startsAt" type="datetime-local" defaultValue={local(banner?.startsAt ?? null)} />
        </div>
        <div className="field">
          <label>Ends</label>
          <input name="endsAt" type="datetime-local" defaultValue={local(banner?.endsAt ?? null)} />
        </div>
      </div>
      <div className="cluster">
        <label className="check">
          <input type="checkbox" name="active" defaultChecked={banner?.active ?? true} />
          Active
        </label>
        <SubmitButton className="btn-sm" pendingLabel="Saving…">
          {banner ? "Save banner" : "Add banner"}
        </SubmitButton>
        <FormMessage state={state} />
      </div>
    </form>
  );
}
