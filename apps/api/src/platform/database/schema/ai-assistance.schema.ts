import {
  pgTable,
  integer,
  text,
  timestamp,
  varchar,
  boolean,
  doublePrecision,
  serial,
  jsonb,
  index,
  foreignKey,
  unique,
} from "drizzle-orm/pg-core";

import { reportType, suggestionStatus } from "./enums.schema.js";
import { user } from "./identity.schema.js";

export const aiReport = pgTable(
  "AiReport",
  {
    aiSummary: text().notNull(),
    aiTips: jsonb().notNull(),
    categoryBreakdown: jsonb().notNull(),
    createdAt: timestamp({ precision: 3 }).defaultNow().notNull(),
    dayPatterns: jsonb().notNull(),
    generatedAt: timestamp({ precision: 3 }).notNull(),
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
    createdAt: timestamp({ precision: 3 }).defaultNow().notNull(),
    daysOfWeek: jsonb().notNull(),
    expiresAt: timestamp({ precision: 3 }).notNull(),
    id: serial().primaryKey(),
    matchedTodos: jsonb().notNull(),
    reason: text().notNull(),
    scheduledTime: text(),
    status: suggestionStatus().default("PENDING").notNull(),
    suggestedCategoryId: integer(),
    title: text().notNull(),
    updatedAt: timestamp({ precision: 3 })
      .notNull()
      .$defaultFn(() => new Date())
      .$onUpdate(() => new Date()),
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
