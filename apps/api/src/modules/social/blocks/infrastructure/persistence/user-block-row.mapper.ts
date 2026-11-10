import type { userBlock as userBlockTable } from "#api/platform/database/schema/social.schema";
import { instantFromDate, instantToDate } from "#api/shared/domain/time/instant";

import { UserBlock } from "../../domain/user-block.aggregate.js";

type UserBlockRow = typeof userBlockTable.$inferSelect;
type UserBlockInsertRow = typeof userBlockTable.$inferInsert;

export function toUserBlock(row: UserBlockRow): UserBlock {
  return UserBlock.reconstitute({ ...row, createdAt: instantFromDate(row.createdAt) });
}

export function toUserBlockRow(block: UserBlock): UserBlockInsertRow {
  const { createdAt, ...primitives } = block.toPrimitives();
  return { ...primitives, createdAt: instantToDate(createdAt) };
}
