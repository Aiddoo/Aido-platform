import type { friendship as friendshipTable } from "#api/platform/database/schema/social.schema";

import { Friendship } from "../../domain/friendship.aggregate.js";

type FriendshipRow = typeof friendshipTable.$inferSelect;
type FriendshipInsertRow = typeof friendshipTable.$inferInsert;

export function toFriendship(row: FriendshipRow): Friendship {
  return Friendship.reconstitute(row);
}

export function toFriendshipRow(friendship: Friendship): FriendshipInsertRow {
  return friendship.toPrimitives();
}
