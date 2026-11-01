import {
  pgTable,
  integer,
  text,
  timestamp,
  varchar,
  boolean,
  serial,
  index,
  foreignKey,
} from "drizzle-orm/pg-core";

import { user } from "./identity.schema.js";

export const memo = pgTable(
  "Memo",
  {
    content: varchar({ length: 5000 }).notNull(),
    createdAt: timestamp({ precision: 3 }).defaultNow().notNull(),
    id: serial().primaryKey(),
    isPinned: boolean().default(false).notNull(),
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
      name: "Memo_userId_fkey",
    })
      .onUpdate("cascade")
      .onDelete("cascade"),
    index("Memo_userId_isPinned_sortOrder_idx").using(
      "btree",
      table.userId.asc().nullsLast(),
      table.isPinned.asc().nullsLast(),
      table.sortOrder.asc().nullsLast(),
    ),
    index("Memo_userId_sortOrder_idx").using(
      "btree",
      table.userId.asc().nullsLast(),
      table.sortOrder.asc().nullsLast(),
    ),
  ],
);
