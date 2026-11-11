import { sql } from "drizzle-orm";
import {
  pgTable,
  integer,
  smallint,
  text,
  varchar,
  index,
  foreignKey,
  primaryKey,
  unique,
  uniqueIndex,
} from "drizzle-orm/pg-core";

import { instant } from "../columns/temporal-columns.js";
import { createEntityId } from "../entity-id.js";
import { quotaChargeStatus, quotaMeter, resourceType } from "./enums.schema.js";
import { user } from "./identity.schema.js";

export const resourceBonus = pgTable(
  "ResourceBonus",
  {
    createdAt: instant()
      .default(sql`now()`)
      .notNull(),
    id: text().primaryKey().$defaultFn(createEntityId),
    quantity: integer().notNull(),
    resource: resourceType().notNull(),
    sourceKey: varchar({ length: 128 }).notNull(),
    userId: text().notNull(),
  },
  (table) => [
    foreignKey({
      columns: [table.userId],
      foreignColumns: [user.id],
      name: "ResourceBonus_userId_fkey",
    })
      .onUpdate("cascade")
      .onDelete("cascade"),
    index("ResourceBonus_userId_resource_idx").using(
      "btree",
      table.userId.asc().nullsLast(),
      table.resource.asc().nullsLast(),
    ),
    unique("ResourceBonus_sourceKey_key").on(table.sourceKey),
  ],
);

/** 계량기별 기간 사용량 카운터. AI_PLAN은 아직 User.aiUsageCount·aiUsageResetAt을 쓴다. */
export const quotaUsage = pgTable(
  "QuotaUsage",
  {
    meter: quotaMeter().notNull(),
    periodKey: varchar({ length: 16 }).notNull(),
    // 도메인이 ClockPort 값으로 채운다. 집합 update도 저장소가 명시한다
    updatedAt: instant().notNull(),
    used: integer().notNull(),
    userId: text().notNull(),
  },
  (table) => [
    primaryKey({
      columns: [table.userId, table.meter, table.periodKey],
      name: "QuotaUsage_pkey",
    }),
    foreignKey({
      columns: [table.userId],
      foreignColumns: [user.id],
      name: "QuotaUsage_userId_fkey",
    })
      .onUpdate("cascade")
      .onDelete("cascade"),
  ],
);

/** 차감 한 건의 원장. 고객 문의 때 모든 차감·환불을 설명한다. */
export const quotaCharge = pgTable(
  "QuotaCharge",
  {
    amount: smallint().notNull(),
    attempt: smallint().notNull(),
    createdAt: instant()
      .default(sql`now()`)
      .notNull(),
    id: text().primaryKey().$defaultFn(createEntityId),
    idempotencyKey: varchar({ length: 128 }),
    meter: quotaMeter().notNull(),
    periodKey: varchar({ length: 16 }).notNull(),
    reason: varchar({ length: 64 }).notNull(),
    refundReason: varchar({ length: 64 }),
    /** 같은 키가 같은 요청인지 가리는 SHA-256 지문. 사용자 글자는 저장하지 않는다. */
    requestHash: varchar({ length: 64 }),
    status: quotaChargeStatus().notNull(),
    // 도메인이 ClockPort 값으로 채운다. 집합 update도 저장소가 명시한다
    updatedAt: instant().notNull(),
    userId: text().notNull(),
  },
  (table) => [
    foreignKey({
      columns: [table.userId],
      foreignColumns: [user.id],
      name: "QuotaCharge_userId_fkey",
    })
      .onUpdate("cascade")
      .onDelete("cascade"),
    index("QuotaCharge_userId_createdAt_idx").using(
      "btree",
      table.userId.asc().nullsLast(),
      table.createdAt.asc().nullsLast(),
    ),
    // 멈춘 예약 정리 잡이 10분마다 RESERVED만 오래된 순으로 찾는다. 확정·환불 행은 쌓이기만 하므로 인덱스에서 뺀다.
    index("QuotaCharge_requestHash_createdAt_idx")
      .using("btree", table.createdAt.asc().nullsLast())
      .where(sql`("requestHash" IS NOT NULL)`),
    index("QuotaCharge_reserved_updatedAt_idx")
      .using("btree", table.updatedAt.asc().nullsLast())
      .where(sql`("status" = 'RESERVED')`),
    uniqueIndex("QuotaCharge_userId_meter_idempotencyKey_key")
      .using(
        "btree",
        table.userId.asc().nullsLast(),
        table.meter.asc().nullsLast(),
        table.idempotencyKey.asc().nullsLast(),
      )
      .where(sql`("idempotencyKey" IS NOT NULL)`),
  ],
);
