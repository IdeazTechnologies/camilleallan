import { NextResponse, type NextRequest } from "next/server";
import { isAuthorizedCron } from "@/lib/cron";
import { releaseExpiredReservations } from "@/lib/orders";

export async function GET(request: NextRequest) {
  if (!isAuthorizedCron(request)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const result = await releaseExpiredReservations(200);
  return NextResponse.json(result);
}
