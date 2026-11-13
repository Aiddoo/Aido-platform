import { sql } from "drizzle-orm";
import {
  pgTable,
  integer,
  text,
  char,
  varchar,
  boolean,
  serial,
  index,
  uniqueIndex,
  foreignKey,
  primaryKey,
  unique,
} from "drizzle-orm/pg-core";

import { createEntityId } from "../../../shared/domain/model/entity-id.js";
import { instant, plainDate } from "../columns/temporal-columns.js";
import {
  followStatus,
  nudgeReplyKind,
  inviteRedemptionStatus,
  inviteRejectionReason,
  inviteStatus,
  rewardClaimKind,
  rewardGrantStatus,
  rewardSourceType,
  rewardType,
  userReportReason,
  userReportStatus,
  userReportTargetType,
} from "./enums.schema.js";
import { user } from "./identity.schema.js";
import { todo } from "./planning.schema.js";

export const follow = pgTable(
  "Follow",
  {
    createdAt: instant()
      .default(sql`now()`)
      .notNull(),
    followerId: text().notNull(),
    followingId: text().notNull(),
    id: text().primaryKey().$defaultFn(createEntityId),
    sortOrder: integer().default(0).notNull(),
    status: followStatus().default("PENDING").notNull(),
    // 도메인이 ClockPort 값으로 채운다. 집합 update도 저장소가 명시한다
    updatedAt: instant().notNull(),
  },
  (table) => [
    foreignKey({
      columns: [table.followerId],
      foreignColumns: [user.id],
      name: "Follow_followerId_fkey",
    })
      .onUpdate("cascade")
      .onDelete("cascade"),
    foreignKey({
      columns: [table.followingId],
      foreignColumns: [user.id],
      name: "Follow_followingId_fkey",
    })
      .onUpdate("cascade")
      .onDelete("cascade"),
    index("Follow_followerId_sortOrder_idx").using(
      "btree",
      table.followerId.asc().nullsLast(),
      table.sortOrder.asc().nullsLast(),
    ),
    index("Follow_followerId_status_idx").using(
      "btree",
      table.followerId.asc().nullsLast(),
      table.status.asc().nullsLast(),
    ),
    index("Follow_followingId_status_idx").using(
      "btree",
      table.followingId.asc().nullsLast(),
      table.status.asc().nullsLast(),
    ),
    unique("Follow_followerId_followingId_key").on(table.followerId, table.followingId),
  ],
);

export const cheer = pgTable(
  "Cheer",
  {
    createdAt: instant()
      .default(sql`now()`)
      .notNull(),
    id: serial().primaryKey(),
    message: varchar({ length: 200 }),
    readAt: instant(),
    receiverId: text().notNull(),
    senderId: text().notNull(),
  },
  (table) => [
    foreignKey({
      columns: [table.receiverId],
      foreignColumns: [user.id],
      name: "Cheer_receiverId_fkey",
    })
      .onUpdate("cascade")
      .onDelete("cascade"),
    foreignKey({
      columns: [table.senderId],
      foreignColumns: [user.id],
      name: "Cheer_senderId_fkey",
    })
      .onUpdate("cascade")
      .onDelete("cascade"),
    index("Cheer_receiverId_createdAt_idx").using(
      "btree",
      table.receiverId.asc().nullsLast(),
      table.createdAt.asc().nullsLast(),
    ),
    index("Cheer_senderId_createdAt_idx").using(
      "btree",
      table.senderId.asc().nullsLast(),
      table.createdAt.asc().nullsLast(),
    ),
    index("Cheer_senderId_receiverId_createdAt_idx").using(
      "btree",
      table.senderId.asc().nullsLast(),
      table.receiverId.asc().nullsLast(),
      table.createdAt.asc().nullsLast(),
    ),
    // 받은 응원 목록이 매 쪽 세는 안 읽음 수
    index("Cheer_receiverId_unread_idx")
      .using("btree", table.receiverId.asc().nullsLast())
      .where(sql`("readAt" IS NULL)`),
  ],
);

export const nudge = pgTable(
  "Nudge",
  {
    createdAt: instant()
      .default(sql`now()`)
      .notNull(),
    id: serial().primaryKey(),
    message: varchar({ length: 200 }),
    readAt: instant(),
    receiverId: text().notNull(),
    repliedAt: instant(),
    replyKind: nudgeReplyKind(),
    replyUpdatedAt: instant(),
    senderId: text().notNull(),
    thankedAt: instant(),
    todoId: integer().notNull(),
  },
  (table) => [
    foreignKey({
      columns: [table.receiverId],
      foreignColumns: [user.id],
      name: "Nudge_receiverId_fkey",
    })
      .onUpdate("cascade")
      .onDelete("cascade"),
    foreignKey({
      columns: [table.senderId],
      foreignColumns: [user.id],
      name: "Nudge_senderId_fkey",
    })
      .onUpdate("cascade")
      .onDelete("cascade"),
    foreignKey({
      columns: [table.todoId],
      foreignColumns: [todo.id],
      name: "Nudge_todoId_fkey",
    })
      .onUpdate("cascade")
      .onDelete("cascade"),
    index("Nudge_receiverId_createdAt_idx").using(
      "btree",
      table.receiverId.asc().nullsLast(),
      table.createdAt.asc().nullsLast(),
    ),
    index("Nudge_receiverId_id_idx").using(
      "btree",
      table.receiverId.asc().nullsLast(),
      table.id.asc().nullsLast(),
    ),
    index("Nudge_senderId_createdAt_idx").using(
      "btree",
      table.senderId.asc().nullsLast(),
      table.createdAt.asc().nullsLast(),
    ),
    index("Nudge_senderId_id_idx").using(
      "btree",
      table.senderId.asc().nullsLast(),
      table.id.asc().nullsLast(),
    ),
    index("Nudge_senderId_todoId_createdAt_idx").using(
      "btree",
      table.senderId.asc().nullsLast(),
      table.todoId.asc().nullsLast(),
      table.createdAt.asc().nullsLast(),
    ),
    uniqueIndex("Nudge_thanked_sender_per_todo")
      .using("btree", table.todoId.asc().nullsLast(), table.senderId.asc().nullsLast())
      .where(sql`("thankedAt" IS NOT NULL)`),
    index("Nudge_todoId_idx").using("btree", table.todoId.asc().nullsLast()),
    index("Nudge_todoId_receiverId_thankedAt_id_idx").using(
      "btree",
      table.todoId.asc().nullsLast(),
      table.receiverId.asc().nullsLast(),
      table.thankedAt.asc().nullsLast(),
      table.id.asc().nullsLast(),
    ),
    // 받은 콕 목록이 매 쪽 세는 안 읽음 수
    index("Nudge_receiverId_unread_idx")
      .using("btree", table.receiverId.asc().nullsLast())
      .where(sql`("readAt" IS NULL)`),
  ],
);

export const reminderNudge = pgTable(
  "ReminderNudge",
  {
    createdAt: instant()
      .default(sql`now()`)
      .notNull(),
    id: serial().primaryKey(),
    message: varchar({ length: 200 }),
    receiverId: text().notNull(),
    senderId: text().notNull(),
  },
  (table) => [
    foreignKey({
      columns: [table.receiverId],
      foreignColumns: [user.id],
      name: "ReminderNudge_receiverId_fkey",
    })
      .onUpdate("cascade")
      .onDelete("cascade"),
    foreignKey({
      columns: [table.senderId],
      foreignColumns: [user.id],
      name: "ReminderNudge_senderId_fkey",
    })
      .onUpdate("cascade")
      .onDelete("cascade"),
    index("ReminderNudge_receiverId_createdAt_idx").using(
      "btree",
      table.receiverId.asc().nullsLast(),
      table.createdAt.asc().nullsLast(),
    ),
    index("ReminderNudge_senderId_receiverId_createdAt_idx").using(
      "btree",
      table.senderId.asc().nullsLast(),
      table.receiverId.asc().nullsLast(),
      table.createdAt.asc().nullsLast(),
    ),
  ],
);

export const userBlock = pgTable(
  "UserBlock",
  {
    blockedId: text().notNull(),
    blockerId: text().notNull(),
    createdAt: instant()
      .default(sql`now()`)
      .notNull(),
    id: text().primaryKey().$defaultFn(createEntityId),
  },
  (table) => [
    foreignKey({
      columns: [table.blockedId],
      foreignColumns: [user.id],
      name: "UserBlock_blockedId_fkey",
    })
      .onUpdate("cascade")
      .onDelete("cascade"),
    foreignKey({
      columns: [table.blockerId],
      foreignColumns: [user.id],
      name: "UserBlock_blockerId_fkey",
    })
      .onUpdate("cascade")
      .onDelete("cascade"),
    index("UserBlock_blockedId_blockerId_idx").using(
      "btree",
      table.blockedId.asc().nullsLast(),
      table.blockerId.asc().nullsLast(),
    ),
    index("UserBlock_blockerId_createdAt_id_idx").using(
      "btree",
      table.blockerId.asc().nullsLast(),
      table.createdAt.asc().nullsLast(),
      table.id.asc().nullsLast(),
    ),
    unique("UserBlock_blockerId_blockedId_key").on(table.blockerId, table.blockedId),
  ],
);

export const userReport = pgTable(
  "UserReport",
  {
    createdAt: instant()
      .default(sql`now()`)
      .notNull(),
    detail: varchar({ length: 500 }),
    id: text().primaryKey().$defaultFn(createEntityId),
    reason: userReportReason().notNull(),
    reporterId: text().notNull(),
    status: userReportStatus().default("OPEN").notNull(),
    targetId: varchar({ length: 64 }),
    targetType: userReportTargetType().notNull(),
    targetUserId: text().notNull(),
    resolutionNote: varchar({ length: 500 }),
    resolvedAt: instant(),
    resolvedById: text(),
  },
  (table) => [
    foreignKey({
      columns: [table.reporterId],
      foreignColumns: [user.id],
      name: "UserReport_reporterId_fkey",
    })
      .onUpdate("cascade")
      .onDelete("cascade"),
    foreignKey({
      columns: [table.targetUserId],
      foreignColumns: [user.id],
      name: "UserReport_targetUserId_fkey",
    })
      .onUpdate("cascade")
      .onDelete("cascade"),
    index("UserReport_reporterId_createdAt_idx").using(
      "btree",
      table.reporterId.asc().nullsLast(),
      table.createdAt.asc().nullsLast(),
    ),
    index("UserReport_reporterId_target_createdAt_idx").using(
      "btree",
      table.reporterId.asc().nullsLast(),
      table.targetUserId.asc().nullsLast(),
      table.targetType.asc().nullsLast(),
      table.createdAt.asc().nullsLast(),
    ),
    index("UserReport_status_createdAt_idx").using(
      "btree",
      table.status.asc().nullsLast(),
      table.createdAt.asc().nullsLast(),
    ),
    index("UserReport_targetUserId_createdAt_idx").using(
      "btree",
      table.targetUserId.asc().nullsLast(),
      table.createdAt.asc().nullsLast(),
    ),
  ],
);

export const invite = pgTable(
  "Invite",
  {
    code: varchar({ length: 6 }).notNull(),
    createdAt: instant()
      .default(sql`now()`)
      .notNull(),
    id: text().primaryKey().$defaultFn(createEntityId),
    inviterId: text().notNull(),
    revokedAt: instant(),
    status: inviteStatus().default("ACTIVE").notNull(),
    // 도메인이 ClockPort 값으로 채운다. 집합 update도 저장소가 명시한다
    updatedAt: instant().notNull(),
  },
  (table) => [
    foreignKey({
      columns: [table.inviterId],
      foreignColumns: [user.id],
      name: "Invite_inviterId_fkey",
    })
      .onUpdate("cascade")
      .onDelete("cascade"),
    uniqueIndex("Invite_inviterId_active_key")
      .using("btree", table.inviterId.asc().nullsLast())
      .where(sql`(status = 'ACTIVE'::"InviteStatus")`),
    index("Invite_inviterId_status_idx").using(
      "btree",
      table.inviterId.asc().nullsLast(),
      table.status.asc().nullsLast(),
    ),
    unique("Invite_code_key").on(table.code),
  ],
);

export const inviteActiveDay = pgTable(
  "InviteActiveDay",
  {
    createdAt: instant()
      .default(sql`now()`)
      .notNull(),
    localDate: plainDate().notNull(),
    redemptionId: text().notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.redemptionId, table.localDate], name: "InviteActiveDay_pkey" }),
    foreignKey({
      columns: [table.redemptionId],
      foreignColumns: [inviteRedemption.id],
      name: "InviteActiveDay_redemptionId_fkey",
    })
      .onUpdate("cascade")
      .onDelete("cascade"),
  ],
);

export const inviteRedemption = pgTable(
  "InviteRedemption",
  {
    createdAt: instant()
      .default(sql`now()`)
      .notNull(),
    expiresAt: instant().notNull(),
    id: text().primaryKey().$defaultFn(createEntityId),
    inviteId: text(),
    inviteeId: text().notNull(),
    inviterId: text(),
    inviterRewardEligible: boolean().default(true).notNull(),
    joinedAt: instant().notNull(),
    qualifiedAt: instant(),
    rejectedAt: instant(),
    rejectionReason: inviteRejectionReason(),
    rewardedAt: instant(),
    status: inviteRedemptionStatus().default("JOINED").notNull(),
    timezone: varchar({ length: 50 }).notNull(),
    // 도메인이 ClockPort 값으로 채운다. 집합 update도 저장소가 명시한다
    updatedAt: instant().notNull(),
    qualifyReminderSentAt: instant(),
  },
  (table) => [
    foreignKey({
      columns: [table.inviteeId],
      foreignColumns: [user.id],
      name: "InviteRedemption_inviteeId_fkey",
    })
      .onUpdate("cascade")
      .onDelete("cascade"),
    foreignKey({
      columns: [table.inviteId],
      foreignColumns: [invite.id],
      name: "InviteRedemption_inviteId_fkey",
    })
      .onUpdate("cascade")
      .onDelete("set null"),
    foreignKey({
      columns: [table.inviterId],
      foreignColumns: [user.id],
      name: "InviteRedemption_inviterId_fkey",
    })
      .onUpdate("cascade")
      .onDelete("set null"),
    index("InviteRedemption_inviteId_idx").using("btree", table.inviteId.asc().nullsLast()),
    index("InviteRedemption_inviterId_joinedAt_id_idx").using(
      "btree",
      table.inviterId.asc().nullsLast(),
      table.joinedAt.asc().nullsLast(),
      table.id.asc().nullsLast(),
    ),
    index("InviteRedemption_inviterId_status_joinedAt_id_idx").using(
      "btree",
      table.inviterId.asc().nullsLast(),
      table.status.asc().nullsLast(),
      table.joinedAt.asc().nullsLast(),
      table.id.asc().nullsLast(),
    ),
    index("InviteRedemption_status_expiresAt_idx").using(
      "btree",
      table.status.asc().nullsLast(),
      table.expiresAt.asc().nullsLast(),
    ),
    unique("InviteRedemption_inviteeId_key").on(table.inviteeId),
  ],
);

export const rewardClaim = pgTable("RewardClaim", {
  claimHash: char({ length: 64 }).primaryKey(),
  claimKind: rewardClaimKind().notNull(),
  firstClaimedAt: instant()
    .default(sql`now()`)
    .notNull(),
});

export const rewardGrant = pgTable(
  "RewardGrant",
  {
    appliedAt: instant(),
    attempts: integer().default(0).notNull(),
    createdAt: instant()
      .default(sql`now()`)
      .notNull(),
    id: text().primaryKey().$defaultFn(createEntityId),
    lastErrorCode: varchar({ length: 100 }),
    quantity: integer().notNull(),
    recipientId: text().notNull(),
    rewardType: rewardType().notNull(),
    sourceId: varchar({ length: 64 }).notNull(),
    sourceType: rewardSourceType().notNull(),
    status: rewardGrantStatus().default("PENDING").notNull(),
    // 도메인이 ClockPort 값으로 채운다. 집합 update도 저장소가 명시한다
    updatedAt: instant().notNull(),
  },
  (table) => [
    foreignKey({
      columns: [table.recipientId],
      foreignColumns: [user.id],
      name: "RewardGrant_recipientId_fkey",
    })
      .onUpdate("cascade")
      .onDelete("cascade"),
    index("RewardGrant_recipientId_rewardType_createdAt_idx").using(
      "btree",
      table.recipientId.asc().nullsLast(),
      table.rewardType.asc().nullsLast(),
      table.createdAt.asc().nullsLast(),
    ),
    index("RewardGrant_status_createdAt_idx").using(
      "btree",
      table.status.asc().nullsLast(),
      table.createdAt.asc().nullsLast(),
    ),
    unique("RewardGrant_sourceType_sourceId_recipientId_rewardType_key").on(
      table.sourceType,
      table.sourceId,
      table.recipientId,
      table.rewardType,
    ),
  ],
);
