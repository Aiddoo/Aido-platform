import type { session as sessionTable } from "#api/platform/database/schema/index";

import { Session } from "../../domain/session.aggregate.js";

type SessionRow = typeof sessionTable.$inferSelect;

export function toSession(row: SessionRow): Session {
  return Session.reconstitute({
    id: row.id,
    userId: row.userId,
    refreshTokenHash: row.refreshTokenHash,
    previousTokenHash: row.previousTokenHash,
    tokenFamily: row.tokenFamily,
    tokenVersion: row.tokenVersion,
    deviceFingerprint: row.deviceFingerprint,
    ipAddress: row.ipAddress,
    userAgent: row.userAgent,
    lastUsedAt: row.lastUsedAt,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    expiresAt: row.expiresAt,
    revokedAt: row.revokedAt,
  });
}

export function toSessionRow(session: Session): typeof sessionTable.$inferInsert {
  return session.toPrimitives();
}
