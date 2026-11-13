import type { UserBriefRow } from "#api/modules/social/friends/social-friends.public";
import type { cheer as cheerTable } from "#api/platform/database/schema/index";

import type {
  CheerListItem,
  CheerUserSummary,
} from "../../application/read-models/cheer.read-model.js";
import { Cheer } from "../../domain/cheer.aggregate.js";

type CheerRow = typeof cheerTable.$inferSelect;
type CheerInsertRow = typeof cheerTable.$inferInsert;

export type CheerRowWithUsers = CheerRow & {
  readonly sender: UserBriefRow;
  readonly receiver: UserBriefRow;
};

export function toCheer(row: CheerRow): Cheer {
  return Cheer.reconstitute(row);
}

export function toCheerRow(cheer: Cheer): CheerInsertRow {
  return cheer.toPrimitives();
}

function toCheerUserSummary(row: UserBriefRow): CheerUserSummary {
  return {
    id: row.id,
    userTag: row.userTag,
    name: row.profile?.name ?? null,
    profileImage: row.profile?.profileImage ?? null,
  };
}

export function toCheerListItem(row: CheerRowWithUsers): CheerListItem {
  return {
    id: row.id,
    senderId: row.senderId,
    receiverId: row.receiverId,
    message: row.message,
    readAt: row.readAt,
    createdAt: row.createdAt,
    sender: toCheerUserSummary(row.sender),
    receiver: toCheerUserSummary(row.receiver),
  };
}
