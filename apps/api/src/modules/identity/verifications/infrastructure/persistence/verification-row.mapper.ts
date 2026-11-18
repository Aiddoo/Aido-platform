import type { verification as verificationTable } from "#api/platform/database/schema/index";

import { Verification } from "../../domain/verification.aggregate.js";

type VerificationRow = typeof verificationTable.$inferSelect;

export function toVerification(row: VerificationRow): Verification {
  return Verification.reconstitute({
    id: row.id,
    userId: row.userId,
    type: row.type,
    tokenHash: row.token,
    expiresAt: row.expiresAt,
    attempts: row.attempts,
    usedAt: row.usedAt,
    createdAt: row.createdAt,
  });
}

export function toVerificationRow(
  verification: Verification,
): typeof verificationTable.$inferInsert {
  const { tokenHash, ...primitives } = verification.toPrimitives();
  return { ...primitives, token: tokenHash };
}
