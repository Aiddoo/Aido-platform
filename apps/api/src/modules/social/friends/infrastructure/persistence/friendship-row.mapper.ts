import type { follow as followTable } from "#api/platform/database/schema/social.schema";
import { instantFromDate, instantToDate } from "#api/shared/domain/time/instant";

import { Friendship } from "../../domain/friendship.aggregate.js";

type FollowRow = typeof followTable.$inferSelect;
type FollowInsertRow = typeof followTable.$inferInsert;

export function toFriendship(row: FollowRow): Friendship {
  return Friendship.reconstitute({
    ...row,
    createdAt: instantFromDate(row.createdAt),
    updatedAt: instantFromDate(row.updatedAt),
  });
}

export function toFriendshipRow(friendship: Friendship): FollowInsertRow {
  const { createdAt, updatedAt, ...primitives } = friendship.toPrimitives();
  return {
    ...primitives,
    createdAt: instantToDate(createdAt),
    updatedAt: instantToDate(updatedAt),
  };
}
