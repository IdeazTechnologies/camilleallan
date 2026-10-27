import type { z } from "zod";

export type ActionState = {
  ok?: boolean;
  message?: string;
  errors?: Record<string, string>;
  /** Echo of submitted values so forms can repopulate after a validation error. */
  values?: Record<string, string>;
};

export const initialActionState: ActionState = {};

export function formValues(formData: FormData) {
  const values: Record<string, string> = {};
  for (const [key, value] of formData.entries()) {
    if (typeof value === "string" && !key.startsWith("$ACTION")) values[key] = value;
  }
  return values;
}

export function zodErrors(error: z.ZodError) {
  const errors: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = issue.path.join(".") || "form";
    if (!errors[key]) errors[key] = issue.message;
  }
  return errors;
}

export function checkbox(formData: FormData, name: string) {
  const v = formData.get(name);
  return v === "on" || v === "true" || v === "1";
}

export function str(formData: FormData, name: string) {
  const v = formData.get(name);
  return typeof v === "string" ? v.trim() : "";
}

export function optionalStr(formData: FormData, name: string) {
  const v = str(formData, name);
  return v === "" ? null : v;
}

export function int(formData: FormData, name: string, fallback = 0) {
  const n = Number.parseInt(str(formData, name), 10);
  return Number.isFinite(n) ? n : fallback;
}

export function optionalInt(formData: FormData, name: string) {
  const raw = str(formData, name);
  if (raw === "") return null;
  const n = Number.parseInt(raw, 10);
  return Number.isFinite(n) ? n : null;
}
