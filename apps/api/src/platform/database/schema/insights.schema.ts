import { sql } from "drizzle-orm";
import { pgTable, integer, text, serial, index, foreignKey, unique } from "drizzle-orm/pg-core";

import { createEntityId } from "../../../shared/domain/model/entity-id.js";
import { instant, plainDate } from "../columns/temporal-columns.js";
import { user } from "./identity.schema.js";

export const dailyCompletion = pgTable(
  "DailyCompletion",
  {
    achievedAt: instant().notNull(),
    completedTodos: integer().notNull(),
    createdAt: instant()
      .default(sql`now()`)
      .notNull(),
    date: plainDate().notNull(),
    id: text().primaryKey().$defaultFn(createEntityId),
    totalTodos: integer().notNull(),
    // 도메인이 ClockPort 값으로 채운다. insert-or-update도 저장소가 명시한다
    updatedAt: instant().notNull(),
    userId: text().notNull(),
  },
  (table) => [
    foreignKey({
      columns: [table.userId],
      foreignColumns: [user.id],
      name: "DailyCompletion_userId_fkey",
    })
      .onUpdate("cascade")
      .onDelete("cascade"),
    unique("DailyCompletion_userId_date_key").on(table.userId, table.date),
  ],
);

export const weeklyAchievement = pgTable(
  "WeeklyAchievement",
  {
    achievedAt: instant().notNull(),
    completedTodos: integer().notNull(),
    createdAt: instant()
      .default(sql`now()`)
      .notNull(),
    id: serial().primaryKey(),
    totalTodos: integer().notNull(),
    userId: text().notNull(),
    week: integer().notNull(),
    year: integer().notNull(),
  },
  (table) => [
    foreignKey({
      columns: [table.userId],
      foreignColumns: [user.id],
      name: "WeeklyAchievement_userId_fkey",
    })
      .onUpdate("cascade")
      .onDelete("cascade"),
    index("WeeklyAchievement_userId_year_idx").using(
      "btree",
      table.userId.asc().nullsLast(),
      table.year.asc().nullsLast(),
    ),
    index("WeeklyAchievement_year_week_idx").using(
      "btree",
      table.year.asc().nullsLast(),
      table.week.asc().nullsLast(),
    ),
    unique("WeeklyAchievement_userId_year_week_key").on(table.userId, table.year, table.week),
  ],
);
