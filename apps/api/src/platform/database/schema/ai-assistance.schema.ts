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

import { instant } from "../columns/temporal-columns.js";
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

export const recurringSuggestion = pgTable(
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
