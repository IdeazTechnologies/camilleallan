import { z } from "zod";
import { COUNTRY_NAMES } from "@/data/countries";
import type { Address } from "@/db/schema";

export const addressSchema = z.object({
  name: z.string().trim().min(2, "Please enter the full name.").max(100),
  line1: z.string().trim().min(3, "Please enter the street address.").max(120),
  line2: z.string().trim().max(120).optional().nullable(),
  city: z.string().trim().min(2, "Please enter the city.").max(80),
  region: z.string().trim().min(1, "Please enter the state, province or region.").max(80),
  postalCode: z.string().trim().min(2, "Please enter the postal or ZIP code.").max(16),
  country: z
    .string()
    .trim()
    .toUpperCase()
    .refine((c) => c in COUNTRY_NAMES, "Please choose a country."),
  phone: z.string().trim().max(32).optional().nullable(),
});

/** Reads `${prefix}name`, `${prefix}line1`, ... from a form. */
export function addressFromForm(formData: FormData, prefix = ""): Record<string, string | null> {
  const get = (k: string) => {
    const v = formData.get(`${prefix}${k}`);
    return typeof v === "string" && v.trim() !== "" ? v : null;
  };
  return {
    name: get("name"),
    line1: get("line1"),
    line2: get("line2"),
    city: get("city"),
    region: get("region"),
    postalCode: get("postalCode"),
    country: get("country"),
    phone: get("phone"),
  };
}

export function parseAddress(formData: FormData, prefix = "") {
  return addressSchema.safeParse(addressFromForm(formData, prefix));
}

export function formatAddressLines(a: Address | null | undefined) {
  if (!a) return [];
  return [
    a.name,
    a.line1,
    a.line2,
    [a.city, a.region, a.postalCode].filter(Boolean).join(", "),
    COUNTRY_NAMES[a.country] ?? a.country,
    a.phone,
  ].filter((l): l is string => !!l);
}
