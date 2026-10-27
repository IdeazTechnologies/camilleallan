import { revalidateTag } from "next/cache";
import { NextResponse, type NextRequest } from "next/server";
import { TAGS } from "@/lib/catalog";
import { isAuthorizedCron } from "@/lib/cron";
import { refreshInstagramToken } from "@/lib/instagram";

export async function GET(request: NextRequest) {
  if (!isAuthorizedCron(request)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const result = await refreshInstagramToken();
  revalidateTag(TAGS.instagram, { expire: 0 });
  return NextResponse.json(result);
}
