import "server-only";
import { db } from "@/db";
import { auditLog } from "@/db/schema";

export async function audit(
  actorUserId: string | null,
  action: string,
  entityType: string,
  entityId?: string | null,
  details?: Record<string, unknown>,
) {
  await db.insert(auditLog).values({ actorUserId, action, entityType, entityId, details });
}
