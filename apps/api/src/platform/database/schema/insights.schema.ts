import {
  pgTable,
  integer,
  text,
  timestamp,
  serial,
  date,
  index,
  foreignKey,
  unique,
} from "drizzle-orm/pg-core";

import { createEntityId } from "../entity-id.js";
import { user } from "./identity.schema.js";

export const dailyCompletion = pgTable(
  "DailyCompletion",
  {
    achievedAt: timestamp({ precision: 3 }).notNull(),
    completedTodos: integer().notNull(),
    createdAt: timestamp({ precision: 3 }).defaultNow().notNull(),
    date: date().notNull(),
    id: text().primaryKey().$defaultFn(createEntityId),
    totalTodos: integer().notNull(),
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
    achievedAt: timestamp({ precision: 3 }).notNull(),
    completedTodos: integer().notNull(),
    createdAt: timestamp({ precision: 3 }).defaultNow().notNull(),
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
