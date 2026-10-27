"use client";

import { COUNTRY_OPTIONS } from "@/data/countries";
import type { ActionState } from "@/lib/forms";

type Props = {
  prefix?: string;
  state?: ActionState;
  defaults?: Partial<Record<"name" | "line1" | "line2" | "city" | "region" | "postalCode" | "country" | "phone", string | null>>;
  countries?: string[];
  onCountryChange?: (country: string) => void;
  requirePhone?: boolean;
};

export function AddressFields({ prefix = "", state, defaults = {}, countries, onCountryChange, requirePhone }: Props) {
  const v = (k: keyof NonNullable<Props["defaults"]>) => state?.values?.[`${prefix}${k}`] ?? defaults[k] ?? "";
  const err = (k: string) => state?.errors?.[`${prefix}${k}`];
  const options = countries && countries.length > 0 ? COUNTRY_OPTIONS.filter((c) => countries.includes(c.code)) : COUNTRY_OPTIONS;
  const id = (k: string) => `${prefix}${k}`;

  const field = (k: keyof NonNullable<Props["defaults"]>, label: string, attrs: React.InputHTMLAttributes<HTMLInputElement> = {}) => (
    <div className="field">
      <label htmlFor={id(k)}>{label}</label>
      <input id={id(k)} name={id(k)} defaultValue={v(k)} aria-invalid={!!err(k) || undefined} {...attrs} />
      {err(k) && <span className="error">{err(k)}</span>}
    </div>
  );

  return (
    <div className="stack">
      {field("name", "Full name", { autoComplete: "name", required: true })}
      <div className="field">
        <label htmlFor={id("country")}>Country</label>
        <select
          id={id("country")}
          name={id("country")}
          defaultValue={v("country") || (options.some((o) => o.code === "US") ? "US" : options[0]?.code)}
          onChange={(e) => onCountryChange?.(e.target.value)}
          autoComplete="country"
          required
        >
          {options.map((c) => (
            <option key={c.code} value={c.code}>
              {c.name}
            </option>
          ))}
        </select>
        {err("country") && <span className="error">{err("country")}</span>}
      </div>
      {field("line1", "Street address", { autoComplete: "address-line1", required: true })}
      {field("line2", "Apartment, suite, etc. (optional)", { autoComplete: "address-line2" })}
      <div className="form-row">
        {field("city", "City", { autoComplete: "address-level2", required: true })}
        {field("region", "State / Province", { autoComplete: "address-level1", required: true })}
        {field("postalCode", "ZIP / Postal code", { autoComplete: "postal-code", required: true })}
      </div>
      {field("phone", requirePhone ? "Phone" : "Phone (for delivery questions)", { autoComplete: "tel", type: "tel", required: requirePhone })}
    </div>
  );
}
