import type { cheer as cheerTable } from "#api/platform/database/schema/index";
import { instantFromDate, instantToDate } from "#api/shared/domain/time/instant";

import type { UserBriefRow } from "../../../friends/infrastructure/persistence/user-brief-relation.constants.js";
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
  return Cheer.reconstitute({
    ...row,
    readAt: row.readAt == null ? null : instantFromDate(row.readAt),
    createdAt: instantFromDate(row.createdAt),
  });
}

export function toCheerRow(cheer: Cheer): CheerInsertRow {
  const { readAt, createdAt, ...primitives } = cheer.toPrimitives();
  return {
    ...primitives,
    readAt: readAt == null ? null : instantToDate(readAt),
    createdAt: instantToDate(createdAt),
  };
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
    readAt: row.readAt == null ? null : instantFromDate(row.readAt),
    createdAt: instantFromDate(row.createdAt),
    sender: toCheerUserSummary(row.sender),
    receiver: toCheerUserSummary(row.receiver),
  };
}
