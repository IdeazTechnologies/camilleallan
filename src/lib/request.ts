import "server-only";
import { headers } from "next/headers";
import { choosePublicOrigin } from "@/lib/public-origin";
import { appUrl } from "@/lib/utils";

export async function requestIsSecure() {
  const h = await headers();
  const proto = h.get("x-forwarded-proto")?.split(",")[0]?.trim();
  return proto === "https";
}

/** Origin of the site that handled this request, for links inside emails. */
export async function publicOrigin() {
  const h = await headers();
  return choosePublicOrigin({
    forwardedHost: h.get("x-forwarded-host"),
    host: h.get("host"),
    forwardedProto: h.get("x-forwarded-proto"),
    fallback: appUrl("/"),
  });
}

export async function publicUrl(path: string) {
  const origin = await publicOrigin();
  return `${origin}${path.startsWith("/") ? path : `/${path}`}`;
}
