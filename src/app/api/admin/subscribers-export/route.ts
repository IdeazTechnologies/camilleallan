import { asc } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db } from "@/db";
import { newsletterSubscribers } from "@/db/schema";
import { getCurrentUser } from "@/lib/dal";

function csv(value: string | null | undefined) {
  const s = value ?? "";
  // Prefix formula-like cells so spreadsheets don't execute them.
  const safe = /^[=+\-@]/.test(s) ? `'${s}` : s;
  return /[",\n]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
}

export async function GET() {
  const user = await getCurrentUser();
  if (user?.role !== "admin") return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const rows = await db.query.newsletterSubscribers.findMany({ orderBy: [asc(newsletterSubscribers.createdAt)] });
  const lines = [
    "email,name,status,source,subscribed_at,unsubscribed_at",
    ...rows.map((r) =>
      [r.email, r.name, r.status, r.source, r.confirmedAt?.toISOString(), r.unsubscribedAt?.toISOString()].map(csv).join(","),
    ),
  ];
  return new NextResponse(lines.join("\n"), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="subscribers-${new Date().toISOString().slice(0, 10)}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}
