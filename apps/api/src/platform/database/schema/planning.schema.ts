import {
  pgTable,
  integer,
  text,
  timestamp,
  varchar,
  boolean,
  serial,
  date,
  index,
  foreignKey,
  primaryKey,
  unique,
} from "drizzle-orm/pg-core";

import { todoVisibility } from "./enums.schema.js";
import { user } from "./identity.schema.js";

export const todo = pgTable(
  "Todo",
  {
    categoryId: integer().notNull(),
    commentCount: integer().default(0).notNull(),
    completed: boolean().default(false).notNull(),
    completedAt: timestamp({ precision: 3 }),
    createdAt: timestamp({ precision: 3 }).defaultNow().notNull(),
    endDate: date(),
    id: serial().primaryKey(),
    isAllDay: boolean().default(true).notNull(),
    recurrenceGroupId: varchar({ length: 36 }),
    scheduledTime: timestamp({ precision: 3, withTimezone: true }),
    sortOrder: integer().default(0).notNull(),
    startDate: date().notNull(),
    title: varchar({ length: 200 }).notNull(),
    updatedAt: timestamp({ precision: 3 })
      .notNull()
      .$defaultFn(() => new Date())
      .$onUpdate(() => new Date()),
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
    index("Todo_recurrenceGroupId_idx").using("btree", table.recurrenceGroupId.asc().nullsLast()),
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
    createdAt: timestamp({ precision: 3 }).defaultNow().notNull(),
    id: serial().primaryKey(),
    sortOrder: integer().default(0).notNull(),
    title: varchar({ length: 200 }).notNull(),
    todoId: integer().notNull(),
    updatedAt: timestamp({ precision: 3 })
      .notNull()
      .$defaultFn(() => new Date())
      .$onUpdate(() => new Date()),
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
    createdAt: timestamp({ precision: 3 }).defaultNow().notNull(),
    id: serial().primaryKey(),
    name: varchar({ length: 50 }).notNull(),
    sortOrder: integer().default(0).notNull(),
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

export const todoView = pgTable(
  "TodoView",
  {
    createdAt: timestamp({ precision: 3 }).defaultNow().notNull(),
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
