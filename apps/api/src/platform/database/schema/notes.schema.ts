import { sql } from "drizzle-orm";
import {
  pgTable,
  integer,
  text,
  varchar,
  boolean,
  serial,
  index,
  foreignKey,
} from "drizzle-orm/pg-core";

import { instant } from "../columns/temporal-columns.js";
import { user } from "./identity.schema.js";

export const memo = pgTable(
  "Memo",
  {
    content: varchar({ length: 5_000 }).notNull(),
    createdAt: instant()
      .default(sql`now()`)
      .notNull(),
    id: serial().primaryKey(),
    isPinned: boolean().default(false).notNull(),
    sortOrder: integer().default(0).notNull(),
    // 도메인이 ClockPort 값으로 채운다. 순서 이동 같은 집합 update도 저장소가 명시한다
    updatedAt: instant().notNull(),
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
