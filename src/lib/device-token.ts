import { createHash } from "node:crypto";

export const DEVICE_COOKIE = "ca.device";
export const DEVICE_MAX_AGE_SECONDS = 60 * 60 * 24 * 400;

export function isDeviceToken(value: string | undefined | null): value is string {
  return !!value && /^[a-f0-9]{64}$/.test(value);
}

export function hashDeviceToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}
