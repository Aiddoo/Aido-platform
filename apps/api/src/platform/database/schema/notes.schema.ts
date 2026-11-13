import { sql } from "drizzle-orm";
import {
  pgTable,
  integer,
  text,
  varchar,
  boolean,
  serial,
  index,
  uniqueIndex,
  foreignKey,
} from "drizzle-orm/pg-core";

import { instant } from "../columns/temporal-columns.js";
import { user } from "./identity.schema.js";

export const memo = pgTable(
  "Memo",
  {
    content: varchar({ length: 5000 }).notNull(),
    createdAt: instant()
      .default(sql`now()`)
      .notNull(),
    id: serial().primaryKey(),
    // 앱이 저장 한 번마다 만들어 재시도에 다시 보내는 Idempotency-Key. 보내지 않은 생성(출시 앱·음성 계획)은 null이다
    idempotencyKey: varchar({ length: 128 }),
    isPinned: boolean().default(false).notNull(),
    // 같은 Idempotency-Key로 다시 보낸 저장이 처음과 같은 글인지 가리는 SHA-256. 키와 함께만 채운다
    requestHash: varchar({ length: 64 }),
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
    uniqueIndex("Memo_userId_idempotencyKey_key")
      .using("btree", table.userId.asc().nullsLast(), table.idempotencyKey.asc().nullsLast())
      .where(sql`("idempotencyKey" IS NOT NULL)`),
  ],
);
