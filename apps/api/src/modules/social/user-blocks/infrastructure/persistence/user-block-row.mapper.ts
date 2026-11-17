import type { userBlock as userBlockTable } from "#api/platform/database/schema/social.schema";

import { UserBlock } from "../../domain/user-block.aggregate.js";

type UserBlockRow = typeof userBlockTable.$inferSelect;
type UserBlockInsertRow = typeof userBlockTable.$inferInsert;

export function toUserBlock(row: UserBlockRow): UserBlock {
  return UserBlock.reconstitute(row);
}

export function toUserBlockRow(block: UserBlock): UserBlockInsertRow {
  return block.toPrimitives();
}
