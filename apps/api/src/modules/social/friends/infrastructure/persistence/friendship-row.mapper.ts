import type { follow as followTable } from "#api/platform/database/schema/social.schema";

import { Friendship } from "../../domain/friendship.aggregate.js";

type FollowRow = typeof followTable.$inferSelect;
type FollowInsertRow = typeof followTable.$inferInsert;

export function toFriendship(row: FollowRow): Friendship {
  return Friendship.reconstitute(row);
}

export function toFriendshipRow(friendship: Friendship): FollowInsertRow {
  return friendship.toPrimitives();
}
