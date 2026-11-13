import { sql } from "drizzle-orm";
import {
  pgTable,
  integer,
  text,
  varchar,
  boolean,
  serial,
  jsonb,
  index,
  uniqueIndex,
  foreignKey,
  primaryKey,
  unique,
  check,
} from "drizzle-orm/pg-core";

import { instant, plainDate } from "../columns/temporal-columns.js";
import { createEntityId } from "../entity-id.js";
import {
  notificationActionType,
  notificationPurpose,
  notificationType,
  platform,
  pushDeliveryMode,
  pushDeliveryStatus,
  pushDispatchOutboxStatus,
  pushDispatchStatus,
  pushPermissionStatus,
  pushRateLimitPhase,
  retentionExperimentStageName,
  retentionExperimentStageStatus,
  retentionExperimentVariant,
} from "./enums.schema.js";
import { session, user } from "./identity.schema.js";

export const notification = pgTable(
  "Notification",
  {
    actionType: notificationActionType().default("DEEP_LINK").notNull(),
    actionUrl: varchar({ length: 1000 }),
    body: varchar({ length: 500 }).notNull(),
    campaignKey: varchar({ length: 100 }),
    cheerId: integer(),
    copyFacts: jsonb(),
    copyKey: varchar({ length: 150 }),
    createdAt: instant()
      .default(sql`now()`)
      .notNull(),
    friendId: text(),
    id: serial().primaryKey(),
    isRead: boolean().default(false).notNull(),
    metadata: jsonb(),
    notificationDate: plainDate(),
    nudgeId: integer(),
    openedAt: instant(),
    purpose: notificationPurpose().default("TRANSACTIONAL").notNull(),
    readAt: instant(),
    reminderOccurrenceKey: varchar({ length: 16 }),
    title: varchar({ length: 200 }).notNull(),
    todoId: integer(),
    type: notificationType().notNull(),
    userId: text().notNull(),
    variantId: varchar({ length: 100 }),
  },
  (table) => [
    foreignKey({
      columns: [table.userId],
      foreignColumns: [user.id],
      name: "Notification_userId_fkey",
    })
      .onUpdate("cascade")
      .onDelete("cascade"),
    index("Notification_comment_actor_cleanup_idx")
      .using("btree", sql`(metadata ->> 'senderId'::text)`)
      .where(sql`((metadata ->> 'senderId'::text) IS NOT NULL)`),
    index("Notification_createdAt_idx").using("btree", table.createdAt.asc().nullsLast()),
    index("Notification_friend_actor_cleanup_idx")
      .using("btree", table.friendId.asc().nullsLast())
      .where(sql`("friendId" IS NOT NULL)`),
    uniqueIndex("Notification_todo_reminder_occurrence_dedup")
      .using(
        "btree",
        table.todoId.asc().nullsLast(),
        table.type.asc().nullsLast(),
        sql`(metadata ->> 'stage'::text)`,
        sql`(COALESCE("reminderOccurrenceKey", ''::character varying))`,
      )
      .where(sql`((type = 'TODO_REMINDER'::"NotificationType") AND ("todoId" IS NOT NULL))`),
    index("Notification_todoId_type_createdAt_idx").using(
      "btree",
      table.todoId.asc().nullsLast(),
      table.type.asc().nullsLast(),
      table.createdAt.asc().nullsLast(),
    ),
    index("Notification_userId_createdAt_id_idx").using(
      "btree",
      table.userId.asc().nullsLast(),
      table.createdAt.asc().nullsLast(),
      table.id.asc().nullsLast(),
    ),
    index("Notification_userId_isRead_createdAt_idx").using(
      "btree",
      table.userId.asc().nullsLast(),
      table.isRead.asc().nullsLast(),
      table.createdAt.asc().nullsLast(),
    ),
    index("Notification_userId_type_idx").using(
      "btree",
      table.userId.asc().nullsLast(),
      table.type.asc().nullsLast(),
    ),
    index("Notification_userId_type_notificationDate_idx").using(
      "btree",
      table.userId.asc().nullsLast(),
      table.type.asc().nullsLast(),
      table.notificationDate.asc().nullsLast(),
    ),
    check(
      "Notification_todo_comment_action_url_check",
      sql`((type <> 'TODO_SHARED'::"NotificationType") OR ("actionType" <> 'DEEP_LINK'::"NotificationActionType") OR ((metadata ->> 'commentId'::text) IS NULL) OR ("actionUrl" IS NULL))`,
    ),
    check(
      "Notification_todo_comment_sender_check",
      sql`(((metadata ->> 'commentId'::text) IS NULL) OR COALESCE(((jsonb_typeof((metadata -> 'senderId'::text)) = 'string'::text) AND (length((metadata ->> 'senderId'::text)) > 0)), false))`,
    ),
  ],
);

export const pushDevice = pgTable(
  "PushDevice",
  {
    createdAt: instant()
      .default(sql`now()`)
      .notNull(),
    deviceId: varchar({ length: 255 }).notNull(),
    deviceModel: varchar({ length: 40 }),
    id: text().primaryKey().$defaultFn(createEntityId),
    osVersion: varchar({ length: 20 }),
    permissionCanAskAgain: boolean().notNull(),
    permissionStatus: pushPermissionStatus().notNull(),
    platform: platform().notNull(),
    reportedAt: instant().notNull(),
    sessionId: text(),
    // 저장소가 보고 시각(ClockPort)으로 채운다
    updatedAt: instant().notNull(),
    userId: text().notNull(),
  },
  (table) => [
    foreignKey({
      columns: [table.userId],
      foreignColumns: [user.id],
      name: "PushDevice_userId_fkey",
    })
      .onUpdate("cascade")
      .onDelete("cascade"),
    foreignKey({
      columns: [table.sessionId],
      foreignColumns: [session.id],
      name: "PushDevice_sessionId_fkey",
    })
      .onUpdate("cascade")
      .onDelete("cascade"),
    index("PushDevice_sessionId_idx").using("btree", table.sessionId.asc().nullsLast()),
    index("PushDevice_deviceId_idx").using("btree", table.deviceId.asc().nullsLast()),
    unique("PushDevice_userId_deviceId_key").on(table.userId, table.deviceId),
  ],
);

export const pushToken = pgTable(
  "PushToken",
  {
    appVersion: varchar({ length: 30 }),
    createdAt: instant()
      .default(sql`now()`)
      .notNull(),
    deviceId: varchar({ length: 255 }).notNull(),
    id: serial().primaryKey(),
    isActive: boolean().default(true).notNull(),
    lastUsedAt: instant()
      .default(sql`now()`)
      .notNull(),
    payloadVersion: integer().default(1).notNull(),
    platform: platform().notNull(),
    sessionId: text(),
    token: varchar({ length: 255 }).notNull(),
    // 등록·비활성화 때 저장소가 ClockPort 시각을 명시한다
    updatedAt: instant().notNull(),
    userId: text().notNull(),
  },
  (table) => [
    foreignKey({
      columns: [table.userId],
      foreignColumns: [user.id],
      name: "PushToken_userId_fkey",
    })
      .onUpdate("cascade")
      .onDelete("cascade"),
    foreignKey({
      columns: [table.sessionId],
      foreignColumns: [session.id],
      name: "PushToken_sessionId_fkey",
    })
      .onUpdate("cascade")
      .onDelete("cascade"),
    index("PushToken_userId_isActive_idx").using(
      "btree",
      table.userId.asc().nullsLast(),
      table.isActive.asc().nullsLast(),
    ),
    index("PushToken_sessionId_idx").using("btree", table.sessionId.asc().nullsLast()),
    unique("PushToken_token_key").on(table.token),
    unique("PushToken_userId_deviceId_key").on(table.userId, table.deviceId),
  ],
);

export const pushDeliveryAttempt = pgTable(
  "PushDeliveryAttempt",
  {
    createdAt: instant()
      .default(sql`now()`)
      .notNull(),
    dispatchId: integer().notNull(),
    errorCode: varchar({ length: 100 }),
    errorMessage: varchar({ length: 500 }),
    failureKind: varchar({ length: 40 }),
    id: serial().primaryKey(),
    /** 공급자 중립 이름. 컬럼은 운영 데이터 호환을 위해 기존 이름을 유지한다. */
    providerTicketId: varchar("expoTicketId", { length: 100 }),
    pushTokenId: integer().notNull(),
    receiptCheckedAt: instant(),
    status: pushDeliveryStatus().default("PENDING").notNull(),
    // 발송 저장소가 insert·update마다 ClockPort 값으로 명시한다
    updatedAt: instant().notNull(),
    tokenFingerprint: varchar({ length: 64 }),
  },
  (table) => [
    foreignKey({
      columns: [table.dispatchId],
      foreignColumns: [pushDispatch.id],
      name: "PushDeliveryAttempt_dispatchId_fkey",
    })
      .onUpdate("cascade")
      .onDelete("cascade"),
    foreignKey({
      columns: [table.pushTokenId],
      foreignColumns: [pushToken.id],
      name: "PushDeliveryAttempt_pushTokenId_fkey",
    })
      .onUpdate("cascade")
      .onDelete("cascade"),
    index("PushDeliveryAttempt_status_createdAt_idx").using(
      "btree",
      table.status.asc().nullsLast(),
      table.createdAt.asc().nullsLast(),
    ),
    index("PushDeliveryAttempt_pushTokenId_idx").using(
      "btree",
      table.pushTokenId.asc().nullsLast(),
    ),
    unique("PushDeliveryAttempt_dispatchId_pushTokenId_key").on(
      table.dispatchId,
      table.pushTokenId,
    ),
    unique("PushDeliveryAttempt_expoTicketId_key").on(table.providerTicketId),
  ],
);

export const pushDispatch = pgTable(
  "PushDispatch",
  {
    campaignKey: varchar({ length: 100 }),
    createdAt: instant()
      .default(sql`now()`)
      .notNull(),
    deliveryAttemptCount: integer().default(0).notNull(),
    id: serial().primaryKey(),
    lastError: varchar({ length: 500 }),
    localDate: plainDate(),
    notificationId: integer().notNull(),
    openedAt: instant(),
    processingJobAttempt: integer(),
    processingJobId: varchar({ length: 255 }),
    processingStartedAt: instant(),
    purpose: notificationPurpose().notNull(),
    rateLimitReservedAt: instant(),
    scheduledAt: instant()
      .default(sql`now()`)
      .notNull(),
    sentAt: instant(),
    skipReason: varchar({ length: 100 }),
    status: pushDispatchStatus().default("PENDING").notNull(),
    timezone: varchar({ length: 50 }).default("UTC").notNull(),
    // 발송 저장소가 insert·update마다 ClockPort 값으로 명시한다
    updatedAt: instant().notNull(),
    userId: text().notNull(),
    variantId: varchar({ length: 100 }),
  },
  (table) => [
    foreignKey({
      columns: [table.notificationId],
      foreignColumns: [notification.id],
      name: "PushDispatch_notificationId_fkey",
    })
      .onUpdate("cascade")
      .onDelete("cascade"),
    foreignKey({
      columns: [table.userId],
      foreignColumns: [user.id],
      name: "PushDispatch_userId_fkey",
    })
      .onUpdate("cascade")
      .onDelete("cascade"),
    index("PushDispatch_campaignKey_status_createdAt_idx").using(
      "btree",
      table.campaignKey.asc().nullsLast(),
      table.status.asc().nullsLast(),
      table.createdAt.asc().nullsLast(),
    ),
    index("PushDispatch_processing_lease_idx")
      .using("btree", table.processingStartedAt.asc().nullsLast())
      .where(sql`(status = 'PROCESSING'::"PushDispatchStatus")`),
    index("PushDispatch_status_scheduledAt_idx").using(
      "btree",
      table.status.asc().nullsLast(),
      table.scheduledAt.asc().nullsLast(),
    ),
    index("PushDispatch_userId_localDate_purpose_idx").using(
      "btree",
      table.userId.asc().nullsLast(),
      table.localDate.asc().nullsLast(),
      table.purpose.asc().nullsLast(),
    ),
    unique("PushDispatch_notificationId_key").on(table.notificationId),
  ],
);

export const pushDispatchOutbox = pgTable(
  "PushDispatchOutbox",
  {
    availableAt: instant()
      .default(sql`now()`)
      .notNull(),
    createdAt: instant()
      .default(sql`now()`)
      .notNull(),
    deliveryMode: pushDeliveryMode().notNull(),
    dispatchId: integer().primaryKey(),
    force: boolean().default(false).notNull(),
    lastError: varchar({ length: 500 }),
    lockedAt: instant(),
    publishAttempts: integer().default(0).notNull(),
    publishedAt: instant(),
    status: pushDispatchOutboxStatus().default("PENDING").notNull(),
    // 발송 저장소가 insert·update마다 ClockPort 값으로 명시한다
    updatedAt: instant().notNull(),
  },
  (table) => [
    foreignKey({
      columns: [table.dispatchId],
      foreignColumns: [pushDispatch.id],
      name: "PushDispatchOutbox_dispatchId_fkey",
    })
      .onUpdate("cascade")
      .onDelete("cascade"),
    index("PushDispatchOutbox_status_availableAt_dispatchId_idx").using(
      "btree",
      table.status.asc().nullsLast(),
      table.availableAt.asc().nullsLast(),
      table.dispatchId.asc().nullsLast(),
    ),
    index("PushDispatchOutbox_status_lockedAt_idx").using(
      "btree",
      table.status.asc().nullsLast(),
      table.lockedAt.asc().nullsLast(),
    ),
  ],
);

export const pushRateLimitReservation = pgTable(
  "PushRateLimitReservation",
  {
    dispatchId: integer().notNull(),
    localDate: plainDate(),
    phase: pushRateLimitPhase().notNull(),
    reservedAt: instant()
      .default(sql`now()`)
      .notNull(),
    userId: text().notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.dispatchId, table.phase], name: "PushRateLimitReservation_pkey" }),
    foreignKey({
      columns: [table.dispatchId],
      foreignColumns: [pushDispatch.id],
      name: "PushRateLimitReservation_dispatchId_fkey",
    })
      .onUpdate("cascade")
      .onDelete("cascade"),
    index("PushRateLimitReservation_phase_userId_localDate_reservedAt_idx").using(
      "btree",
      table.phase.asc().nullsLast(),
      table.userId.asc().nullsLast(),
      table.localDate.asc().nullsLast(),
      table.reservedAt.asc().nullsLast(),
    ),
    index("PushRateLimitReservation_phase_userId_reservedAt_idx").using(
      "btree",
      table.phase.asc().nullsLast(),
      table.userId.asc().nullsLast(),
      table.reservedAt.asc().nullsLast(),
    ),
  ],
);

export const retentionExperimentAssignment = pgTable(
  "RetentionExperimentAssignment",
  {
    // 코드는 읽지 않지만 DB 기본값으로만 남는 배정 시각이고 다른 칸에 없어(실험 분석 자료) 지우지 않는다
    assignedAt: instant()
      .default(sql`now()`)
      .notNull(),
    experimentKey: varchar({ length: 100 }).notNull(),
    id: text().primaryKey().$defaultFn(createEntityId),
    startedAt: instant(),
    userId: text().notNull(),
    variant: retentionExperimentVariant().notNull(),
  },
  (table) => [
    foreignKey({
      columns: [table.userId],
      foreignColumns: [user.id],
      name: "RetentionExperimentAssignment_userId_fkey",
    })
      .onUpdate("cascade")
      .onDelete("cascade"),
    index("RetentionExperimentAssignment_experimentKey_variant_startedAt_i").using(
      "btree",
      table.experimentKey.asc().nullsLast(),
      table.variant.asc().nullsLast(),
      table.startedAt.asc().nullsLast(),
    ),
    unique("RetentionExperimentAssignment_userId_experimentKey_key").on(
      table.userId,
      table.experimentKey,
    ),
  ],
);

export const retentionExperimentResult = pgTable(
  "RetentionExperimentResult",
  {
    assignmentId: text().notNull(),
    id: text().primaryKey().$defaultFn(createEntityId),
    measuredAt: instant()
      .default(sql`now()`)
      .notNull(),
    returnedWithinD7: boolean().notNull(),
    todoActionWithinD7: boolean().notNull(),
  },
  (table) => [
    foreignKey({
      columns: [table.assignmentId],
      foreignColumns: [retentionExperimentAssignment.id],
      name: "RetentionExperimentResult_assignmentId_fkey",
    })
      .onUpdate("cascade")
      .onDelete("cascade"),
    index("RetentionExperimentResult_measuredAt_idx").using(
      "btree",
      table.measuredAt.asc().nullsLast(),
    ),
    unique("RetentionExperimentResult_assignmentId_key").on(table.assignmentId),
  ],
);

export const retentionExperimentStage = pgTable(
  "RetentionExperimentStage",
  {
    assignmentId: text().notNull(),
    createdAt: instant()
      .default(sql`now()`)
      .notNull(),
    id: text().primaryKey().$defaultFn(createEntityId),
    notificationId: integer(),
    processedAt: instant(),
    skipReason: varchar({ length: 100 }),
    stage: retentionExperimentStageName().notNull(),
    status: retentionExperimentStageStatus().default("SCHEDULED").notNull(),
    // 리텐션 저장소가 단계를 만들고 바꿀 때마다 그 시각으로 명시한다
    updatedAt: instant().notNull(),
  },
  (table) => [
    foreignKey({
      columns: [table.assignmentId],
      foreignColumns: [retentionExperimentAssignment.id],
      name: "RetentionExperimentStage_assignmentId_fkey",
    })
      .onUpdate("cascade")
      .onDelete("cascade"),
    index("RetentionExperimentStage_status_stage_createdAt_idx").using(
      "btree",
      table.status.asc().nullsLast(),
      table.stage.asc().nullsLast(),
      table.createdAt.asc().nullsLast(),
    ),
    unique("RetentionExperimentStage_assignmentId_stage_key").on(table.assignmentId, table.stage),
    unique("RetentionExperimentStage_notificationId_key").on(table.notificationId),
  ],
);
