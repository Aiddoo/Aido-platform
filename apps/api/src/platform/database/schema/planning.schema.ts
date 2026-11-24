import { TODO_IMPORT_ACTIVE_STATUSES } from "@aido/api/vocabulary";
import { sql } from "drizzle-orm";
import {
  pgTable,
  integer,
  jsonb,
  smallint,
  text,
  varchar,
  boolean,
  serial,
  check,
  index,
  foreignKey,
  primaryKey,
  unique,
  uniqueIndex,
} from "drizzle-orm/pg-core";

// drizzle-kit은 #api 별칭을 못 따라가므로 상대 경로로 둔다
import type { TodoImportCollectionPrimitives } from "../../../modules/planning/todo-imports/domain/todo-import-collection.vo.js";
import type { TodoImportTargetPrimitives } from "../../../modules/planning/todo-imports/domain/todo-import-target.vo.js";
import type { TodoImportFailureReason } from "../../../modules/planning/todo-imports/domain/todo-imports.constants.js";
import { instant, plainDate } from "../columns/temporal-columns.js";
import {
  todoImportItemStatus,
  todoImportSource,
  todoImportStatus,
  todoImportTimeMode,
  todoRepeatFrequency,
  todoVisibility,
} from "./enums.schema.js";
import { user } from "./identity.schema.js";

export const todo = pgTable(
  "Todo",
  {
    categoryId: integer().notNull(),
    commentCount: integer().default(0).notNull(),
    completed: boolean().default(false).notNull(),
    completedAt: instant(),
    createdAt: instant()
      .default(sql`now()`)
      .notNull(),
    endDate: plainDate(),
    id: serial().primaryKey(),
    isAllDay: boolean().default(true).notNull(),
    occurrenceDate: plainDate(),
    // 코드 이름은 seriesId. 열 이름을 바꾸면 배포가 겹치는 동안 옛 이미지가 실패해 DB 열 이름은 그대로 둔다.
    seriesId: varchar("recurrenceGroupId", { length: 36 }),
    // 벽시계(HH:mm)가 진실이고 scheduledTime은 startDate + 이 값 + 사용자 시간대로 만든 파생값이다.
    scheduledLocalTime: varchar({ length: 5 }),
    scheduledTime: instant({ withTimezone: true }),
    sortOrder: integer().default(0).notNull(),
    startDate: plainDate().notNull(),
    title: varchar({ length: 200 }).notNull(),
    // 할 일 저장소·조회·댓글 수 어댑터가 ClockPort 값으로 insert·update마다 명시한다(순서 밀기 포함)
    updatedAt: instant().notNull(),
    userId: text().notNull(),
    viewCount: integer().default(0).notNull(),
    visibility: todoVisibility().default("PUBLIC").notNull(),
  },
  (table) => [
    foreignKey({
      columns: [table.categoryId],
      foreignColumns: [todoCategory.id],
      name: "Todo_categoryId_fkey",
    })
      .onUpdate("cascade")
      .onDelete("restrict"),
    foreignKey({
      columns: [table.userId],
      foreignColumns: [user.id],
      name: "Todo_userId_fkey",
    })
      .onUpdate("cascade")
      .onDelete("cascade"),
    index("Todo_completed_scheduledTime_idx").using(
      "btree",
      table.completed.asc().nullsLast(),
      table.scheduledTime.asc().nullsLast(),
    ),
    uniqueIndex("Todo_recurrenceGroupId_occurrenceDate_key")
      .on(table.seriesId, table.occurrenceDate)
      .where(sql`${table.occurrenceDate} IS NOT NULL`),
    index("Todo_userId_categoryId_idx").using(
      "btree",
      table.userId.asc().nullsLast(),
      table.categoryId.asc().nullsLast(),
    ),
    index("Todo_userId_completed_startDate_idx").using(
      "btree",
      table.userId.asc().nullsLast(),
      table.completed.asc().nullsLast(),
      table.startDate.asc().nullsLast(),
    ),
    index("Todo_userId_sortOrder_idx").using(
      "btree",
      table.userId.asc().nullsLast(),
      table.sortOrder.asc().nullsLast(),
    ),
    index("Todo_userId_startDate_endDate_idx").using(
      "btree",
      table.userId.asc().nullsLast(),
      table.startDate.asc().nullsLast(),
      table.endDate.asc().nullsLast(),
    ),
  ],
);

export const todoItem = pgTable(
  "TodoItem",
  {
    completed: boolean().default(false).notNull(),
    createdAt: instant()
      .default(sql`now()`)
      .notNull(),
    id: serial().primaryKey(),
    sortOrder: integer().default(0).notNull(),
    title: varchar({ length: 200 }).notNull(),
    todoId: integer().notNull(),
    // 할 일 저장소가 ClockPort 값으로 insert·update마다 명시한다(순서 바꾸기 포함)
    updatedAt: instant().notNull(),
  },
  (table) => [
    foreignKey({
      columns: [table.todoId],
      foreignColumns: [todo.id],
      name: "TodoItem_todoId_fkey",
    })
      .onUpdate("cascade")
      .onDelete("cascade"),
    index("TodoItem_todoId_sortOrder_idx").using(
      "btree",
      table.todoId.asc().nullsLast(),
      table.sortOrder.asc().nullsLast(),
    ),
  ],
);

export const todoCategory = pgTable(
  "TodoCategory",
  {
    color: varchar({ length: 7 }).notNull(),
    createdAt: instant()
      .default(sql`now()`)
      .notNull(),
    id: serial().primaryKey(),
    name: varchar({ length: 50 }).notNull(),
    sortOrder: integer().default(0).notNull(),
    // 카테고리 저장소가 ClockPort 값으로 insert·update마다 명시한다(순서 밀기 포함)
    updatedAt: instant().notNull(),
    userId: text().notNull(),
  },
  (table) => [
    foreignKey({
      columns: [table.userId],
      foreignColumns: [user.id],
      name: "TodoCategory_userId_fkey",
    })
      .onUpdate("cascade")
      .onDelete("cascade"),
    index("TodoCategory_userId_sortOrder_idx").using(
      "btree",
      table.userId.asc().nullsLast(),
      table.sortOrder.asc().nullsLast(),
    ),
    unique("TodoCategory_userId_name_key").on(table.userId, table.name),
  ],
);

export const todoSeries = pgTable(
  "TodoSeries",
  {
    categoryId: integer().notNull(),
    checklistTemplate: jsonb().$type<{ title: string }[]>().default([]).notNull(),
    createdAt: instant()
      .default(sql`now()`)
      .notNull(),
    generatedCount: integer().default(0).notNull(),
    // 기존 recurrenceGroupId 값을 그대로 이어 쓰므로 Todo.recurrenceGroupId와 같은 형식이다.
    id: varchar({ length: 36 }).primaryKey(),
    nextOccurrenceDate: plainDate(),
    // 이후 수정으로 나뉜 구간을 재귀 없이 한 쿼리로 묶는다. 원본 행이 먼저 지워질 수 있어 FK를 걸지 않는다.
    originSeriesId: varchar({ length: 36 }).notNull(),
    repeatCount: smallint(),
    repeatFrequency: todoRepeatFrequency().notNull(),
    repeatInterval: smallint().default(1).notNull(),
    repeatMonthDay: smallint(),
    repeatUntil: plainDate(),
    repeatWeekdays: text().array(),
    scheduledLocalTime: varchar({ length: 5 }),
    startDate: plainDate().notNull(),
    timezone: varchar({ length: 50 }).notNull(),
    title: varchar({ length: 200 }).notNull(),
    // 반복 저장소가 ClockPort 값으로 insert·update마다 명시한다(시간대 일괄 변경 포함)
    updatedAt: instant().notNull(),
    userId: text().notNull(),
    visibility: todoVisibility().default("PUBLIC").notNull(),
  },
  (table) => [
    foreignKey({
      columns: [table.categoryId],
      foreignColumns: [todoCategory.id],
      name: "TodoSeries_categoryId_fkey",
    })
      .onUpdate("cascade")
      .onDelete("restrict"),
    foreignKey({
      columns: [table.userId],
      foreignColumns: [user.id],
      name: "TodoSeries_userId_fkey",
    })
      .onUpdate("cascade")
      .onDelete("cascade"),
    index("TodoSeries_nextOccurrenceDate_idx")
      .on(table.nextOccurrenceDate)
      .where(sql`${table.nextOccurrenceDate} IS NOT NULL`),
    index("TodoSeries_userId_nextOccurrenceDate_idx").on(table.userId, table.nextOccurrenceDate),
    index("TodoSeries_categoryId_idx").on(table.categoryId),
    index("TodoSeries_userId_originSeriesId_idx").on(table.userId, table.originSeriesId),
    check("TodoSeries_repeatInterval_check", sql`${table.repeatInterval} IN (1, 2)`),
    check(
      "TodoSeries_repeatWeekdays_check",
      sql`(${table.repeatFrequency} = 'WEEKLY') = (${table.repeatWeekdays} IS NOT NULL AND cardinality(${table.repeatWeekdays}) > 0) AND (${table.repeatWeekdays} IS NULL OR ${table.repeatWeekdays} <@ ARRAY['MON','TUE','WED','THU','FRI','SAT','SUN']::text[])`,
    ),
    check(
      "TodoSeries_repeatMonthDay_check",
      sql`(${table.repeatFrequency} = 'MONTHLY') = (${table.repeatMonthDay} IS NOT NULL) AND (${table.repeatMonthDay} IS NULL OR ${table.repeatMonthDay} BETWEEN 1 AND 31)`,
    ),
    check(
      "TodoSeries_repeatCount_check",
      sql`${table.repeatCount} IS NULL OR ${table.repeatCount} BETWEEN 1 AND 365`,
    ),
    check(
      "TodoSeries_repeatEnd_check",
      sql`${table.repeatUntil} IS NULL OR ${table.repeatCount} IS NULL`,
    ),
  ],
);

export const todoView = pgTable(
  "TodoView",
  {
    createdAt: instant()
      .default(sql`now()`)
      .notNull(),
    todoId: integer().notNull(),
    viewerId: text().notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.todoId, table.viewerId], name: "TodoView_pkey" }),
    foreignKey({
      columns: [table.todoId],
      foreignColumns: [todo.id],
      name: "TodoView_todoId_fkey",
    })
      .onUpdate("cascade")
      .onDelete("cascade"),
    foreignKey({
      columns: [table.viewerId],
      foreignColumns: [user.id],
      name: "TodoView_viewerId_fkey",
    })
      .onUpdate("cascade")
      .onDelete("cascade"),
    index("TodoView_viewerId_createdAt_idx").using(
      "btree",
      table.viewerId.asc().nullsLast(),
      table.createdAt.asc().nullsLast(),
    ),
  ],
);

const ACTIVE_TODO_IMPORT_STATUS_LIST = sql.raw(
  TODO_IMPORT_ACTIVE_STATUSES.map((status) => `'${status}'`).join(", "),
);

export const todoImport = pgTable(
  "TodoImport",
  {
    id: text().primaryKey(),
    userId: text().notNull(),
    source: todoImportSource().notNull(),
    status: todoImportStatus().notNull(),
    idempotencyKey: text().notNull(),
    requestHash: varchar({ length: 64 }).notNull(),
    timezone: varchar({ length: 50 }).notNull(),
    startDate: plainDate().notNull(),
    endDate: plainDate().notNull(),
    timeMode: todoImportTimeMode().notNull(),
    visibility: todoVisibility().notNull(),
    // 앱이 시작 요청에 담은 대상·캘린더. 가져오기마다 최대 20개라 행 하나에 둔다
    targets: jsonb().$type<readonly TodoImportTargetPrimitives[]>().notNull(),
    collections: jsonb().$type<readonly TodoImportCollectionPrimitives[]>().notNull(),
    expectedItemCount: integer().notNull(),
    receivedItemCount: integer().default(0).notNull(),
    processedItemCount: integer().default(0).notNull(),
    createdCount: integer().default(0).notNull(),
    skippedDuplicateCount: integer().default(0).notNull(),
    skippedCapacityCount: integer().default(0).notNull(),
    skippedCategoryMissingCount: integer().default(0).notNull(),
    skippedInvalidCount: integer().default(0).notNull(),
    undoneCount: integer().default(0).notNull(),
    keptCompletedCount: integer().default(0).notNull(),
    firstDate: plainDate(),
    // 잡 round. 같은 값의 작업만 처리해 재시도·재조정이 겹쳐도 한 줄로 이어진다
    round: integer().default(0).notNull(),
    recoveryCount: integer().default(0).notNull(),
    failureReason: varchar({ length: 50 }).$type<TodoImportFailureReason>(),
    createdAt: instant().notNull(),
    // 묶음마다 ClockPort 값으로 쓴다. 재조정자가 진행이 멈췄는지 이 값으로 본다
    updatedAt: instant().notNull(),
    committedAt: instant(),
    completedAt: instant(),
    undoRequestedAt: instant(),
  },
  (table) => [
    foreignKey({
      columns: [table.userId],
      foreignColumns: [user.id],
      name: "TodoImport_userId_fkey",
    })
      .onUpdate("cascade")
      .onDelete("cascade"),
    unique("TodoImport_userId_idempotencyKey_key").on(table.userId, table.idempotencyKey),
    // 사용자마다 진행 중인 가져오기는 하나다(TODO_IMPORT_2301)
    uniqueIndex("TodoImport_userId_active_key")
      .on(table.userId)
      .where(sql`${table.status} IN (${ACTIVE_TODO_IMPORT_STATUS_LIST})`),
    index("TodoImport_status_updatedAt_idx").on(table.status, table.updatedAt),
  ],
);

export const todoImportItem = pgTable(
  "TodoImportItem",
  {
    importId: text().notNull(),
    sourceKey: varchar({ length: 64 }).notNull(),
    collectionKey: varchar({ length: 64 }).notNull(),
    title: varchar({ length: 200 }).notNull(),
    startDate: plainDate().notNull(),
    endDate: plainDate(),
    localTime: varchar({ length: 5 }),
    status: todoImportItemStatus().default("PENDING").notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.importId, table.sourceKey], name: "TodoImportItem_pkey" }),
    foreignKey({
      columns: [table.importId],
      foreignColumns: [todoImport.id],
      name: "TodoImportItem_importId_fkey",
    })
      .onUpdate("cascade")
      .onDelete("cascade"),
    // 가까운 날짜부터 처리한다. 300 한도에 닿으면 먼 일정이 빠진다
    index("TodoImportItem_importId_pending_idx")
      .on(table.importId, table.startDate, table.localTime, table.sourceKey)
      .where(sql`${table.status} = 'PENDING'`),
  ],
);

export const todoImportLink = pgTable(
  "TodoImportLink",
  {
    // 할 일을 지우면 링크도 지워져 같은 일정을 다시 가져올 수 있다
    todoId: integer().primaryKey(),
    userId: text().notNull(),
    sourceKey: varchar({ length: 64 }).notNull(),
    importId: text(),
    createdAt: instant().notNull(),
  },
  (table) => [
    foreignKey({
      columns: [table.todoId],
      foreignColumns: [todo.id],
      name: "TodoImportLink_todoId_fkey",
    })
      .onUpdate("cascade")
      .onDelete("cascade"),
    foreignKey({
      columns: [table.userId],
      foreignColumns: [user.id],
      name: "TodoImportLink_userId_fkey",
    })
      .onUpdate("cascade")
      .onDelete("cascade"),
    foreignKey({
      columns: [table.importId],
      foreignColumns: [todoImport.id],
      name: "TodoImportLink_importId_fkey",
    })
      .onUpdate("cascade")
      .onDelete("set null"),
    unique("TodoImportLink_userId_sourceKey_key").on(table.userId, table.sourceKey),
    index("TodoImportLink_importId_todoId_idx").on(table.importId, table.todoId),
  ],
);
