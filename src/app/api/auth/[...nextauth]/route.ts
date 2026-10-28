import { NextResponse, type NextRequest } from "next/server";
import { handlers } from "@/auth";
import { rateLimit } from "@/lib/rate-limit";

export const { POST } = handlers;

// Old magic-link callbacks land here. Password codes are checked in the login actions.
export async function GET(request: NextRequest) {
  const url = request.nextUrl;
  if (url.pathname.endsWith("/callback/email")) {
    const email = (url.searchParams.get("email") ?? "").toLowerCase();
    const ip = request.headers.get("x-real-ip") ?? request.headers.get("x-forwarded-for")?.split(",")[0] ?? "unknown";
    const allowed =
      (await rateLimit(`login-verify:${email}`, 8, 15 * 60)) &&
      (await rateLimit(`login-verify-ip:${ip}`, 30, 15 * 60));
    if (!allowed) {
      return NextResponse.redirect(new URL("/login?error=TooManyAttempts", url));
    }
  }
  return handlers.GET(request);
}
