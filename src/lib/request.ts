import "server-only";
import { headers } from "next/headers";
import { appUrl } from "@/lib/utils";

export async function requestIsSecure() {
  const h = await headers();
  const proto = h.get("x-forwarded-proto")?.split(",")[0]?.trim();
  return proto === "https";
}

/** Origin used in emailed links. Local requests keep their own host; production uses APP_URL. */
export async function publicOrigin() {
  const h = await headers();
  const host = h.get("x-forwarded-host")?.split(",")[0]?.trim() ?? h.get("host") ?? "";
  const hostname = host.split(":")[0];
  if (hostname === "localhost" || hostname === "127.0.0.1") {
    return `${(await requestIsSecure()) ? "https" : "http"}://${host}`;
  }
  return appUrl("/").replace(/\/$/, "");
}
