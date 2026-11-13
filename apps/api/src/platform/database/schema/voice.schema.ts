import type { ActionPlanSource } from "@aido/api/vocabulary";
import { sql } from "drizzle-orm";
import {
  foreignKey,
  index,
  integer,
  pgTable,
  text,
  uniqueIndex,
  varchar,
} from "drizzle-orm/pg-core";

import { createEntityId } from "../../../shared/domain/model/entity-id.js";
import { instant } from "../columns/temporal-columns.js";
import { user } from "./identity.schema.js";

/**
 * 계획 적용 한 번의 멱등 기록. 7일 뒤 지운다. 사용자 글자는 두지 않고 만든 id와 요청 해시만 둔다.
 * 할 일·메모는 그 뒤 지워질 수 있어 외래 키를 걸지 않는다.
 */
export const planApplication = pgTable(
  "PlanApplication",
  {
    createdAt: instant()
      .default(sql`now()`)
      .notNull(),
    id: text().primaryKey().$defaultFn(createEntityId),
    idempotencyKey: varchar({ length: 128 }).notNull(),
    memoId: integer(),
    requestHash: varchar({ length: 64 }).notNull(),
    source: varchar({ length: 32 }).$type<ActionPlanSource>().notNull(),
    todoIds: integer().array().notNull(),
    userId: text().notNull(),
  },
  (table) => [
    foreignKey({
      columns: [table.userId],
      foreignColumns: [user.id],
      name: "PlanApplication_userId_fkey",
    })
      .onUpdate("cascade")
      .onDelete("cascade"),
    uniqueIndex("PlanApplication_userId_idempotencyKey_key").using(
      "btree",
      table.userId.asc().nullsLast(),
      table.idempotencyKey.asc().nullsLast(),
    ),
    index("PlanApplication_createdAt_idx").using("btree", table.createdAt.asc().nullsLast()),
  ],
);
