import { sql } from "drizzle-orm";
import {
  pgTable,
  integer,
  text,
  varchar,
  boolean,
  doublePrecision,
  serial,
  jsonb,
  index,
  foreignKey,
  unique,
} from "drizzle-orm/pg-core";

import { instant, plainDate } from "../columns/temporal-columns.js";
import { reportType, suggestionStatus } from "./enums.schema.js";
import { user } from "./identity.schema.js";

export const aiReport = pgTable(
  "AiReport",
  {
    aiSummary: text().notNull(),
    aiTips: jsonb().notNull(),
    categoryBreakdown: jsonb().notNull(),
    createdAt: instant()
      .default(sql`now()`)
      .notNull(),
    dayPatterns: jsonb().notNull(),
    generatedAt: instant().notNull(),
    hasActivity: boolean().notNull(),
    id: serial().primaryKey(),
    locale: varchar({ length: 10 }).default("ko").notNull(),
    period: integer().notNull(),
    stats: jsonb().notNull(),
    timePatterns: jsonb().notNull(),
    type: reportType().notNull(),
    userId: text().notNull(),
    year: integer().notNull(),
    contentSource: varchar({ length: 16 }),
    promptVersion: varchar({ length: 40 }),
    dailyCompletions: jsonb(),
  },
  (table) => [
    foreignKey({
      columns: [table.userId],
      foreignColumns: [user.id],
      name: "AiReport_userId_fkey",
    })
      .onUpdate("cascade")
      .onDelete("cascade"),
    index("AiReport_userId_type_generatedAt_idx").using(
      "btree",
      table.userId.asc().nullsLast(),
      table.type.asc().nullsLast(),
      table.generatedAt.asc().nullsLast(),
    ),
    index("AiReport_userId_type_idx").using(
      "btree",
      table.userId.asc().nullsLast(),
      table.type.asc().nullsLast(),
    ),
    unique("AiReport_userId_type_year_period_key").on(
      table.userId,
      table.type,
      table.year,
      table.period,
    ),
  ],
);

export const suggestion = pgTable(
  "RecurringSuggestion",
  {
    confidence: doublePrecision().notNull(),
    createdAt: instant()
      .default(sql`now()`)
      .notNull(),
    daysOfWeek: jsonb().notNull(),
    expiresAt: instant().notNull(),
    id: serial().primaryKey(),
    matchedTodos: jsonb().notNull(),
    reason: text().notNull(),
    scheduledTime: text(),
    status: suggestionStatus().default("PENDING").notNull(),
    suggestedCategoryId: integer(),
    title: text().notNull(),
    // Aggregate가 ClockPort 시각으로 채운다
    updatedAt: instant().notNull(),
    userId: text().notNull(),
    evidenceRecordedCount: integer(),
    evidenceCompletedCount: integer(),
    evidencePeriodDays: integer(),
  },
  (table) => [
    foreignKey({
      columns: [table.userId],
      foreignColumns: [user.id],
      name: "RecurringSuggestion_userId_fkey",
    })
      .onUpdate("cascade")
      .onDelete("cascade"),
    index("RecurringSuggestion_userId_expiresAt_idx").using(
      "btree",
      table.userId.asc().nullsLast(),
      table.expiresAt.asc().nullsLast(),
    ),
    index("RecurringSuggestion_userId_status_idx").using(
      "btree",
      table.userId.asc().nullsLast(),
      table.status.asc().nullsLast(),
    ),
    index("RecurringSuggestion_userId_updatedAt_idx").using(
      "btree",
      table.userId.asc().nullsLast(),
      table.updatedAt.asc().nullsLast(),
    ),
  ],
);

// 값을 더할 때 migration 없이 추가만 하려고 상태·트리거·결과는 enum 대신 varchar이고 row mapper가 Zod로 읽는다
export const suggestionAnalysisRun = pgTable(
  "SuggestionAnalysisRun",
  {
    userId: text().primaryKey(),
    status: varchar({ length: 16 }).notNull(),
    localDate: plainDate().notNull(),
    trigger: varchar({ length: 16 }).notNull(),
    outcome: varchar({ length: 32 }),
    recentTodoCount: integer(),
    createdSuggestionCount: integer(),
    queuedAt: instant().notNull(),
    startedAt: instant(),
    finishedAt: instant(),
  },
  (table) => [
    foreignKey({
      columns: [table.userId],
      foreignColumns: [user.id],
      name: "SuggestionAnalysisRun_userId_fkey",
    })
      .onUpdate("cascade")
      .onDelete("cascade"),
  ],
);
