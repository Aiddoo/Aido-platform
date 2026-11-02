import {
  bigint,
  pgTable,
  integer,
  text,
  timestamp,
  varchar,
  serial,
  index,
  foreignKey,
  primaryKey,
  unique,
} from "drizzle-orm/pg-core";

import { createEntityId } from "../entity-id.js";
import {
  subscriptionEnvironment,
  subscriptionStatus,
  premiumGrantSource,
  premiumGrantStatus,
} from "./enums.schema.js";
import { user } from "./identity.schema.js";

export const subscription = pgTable(
  "Subscription",
  {
    cancelledAt: timestamp({ precision: 3 }),
    createdAt: timestamp({ precision: 3 }).defaultNow().notNull(),
    dataRetentionUntil: timestamp({ precision: 3 }),
    deletedAt: timestamp({ precision: 3 }),
    /** 구매 웹훅의 결제 환경. 이 열을 추가하기 전에 만든 행은 null(알 수 없음)이다. */
    environment: subscriptionEnvironment(),
    expiresAt: timestamp({ precision: 3 }).notNull(),
    /** BILLING_ISSUE가 알려 준 스토어 결제 유예의 끝. 그때까지 엔타이틀먼트가 남고 RENEWAL·EXPIRATION이 지운다. */
    gracePeriodEndsAt: timestamp({ precision: 3 }),
    id: serial().primaryKey(),
    lastProcessedEventId: varchar({ length: 255 }),
    productId: varchar({ length: 100 }).notNull(),
    revenueCatId: varchar({ length: 255 }).notNull(),
    startedAt: timestamp({ precision: 3 }).notNull(),
    status: subscriptionStatus().notNull(),
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
      name: "Subscription_userId_fkey",
    })
      .onUpdate("cascade")
      .onDelete("cascade"),
    index("Subscription_deletedAt_idx").using("btree", table.deletedAt.asc().nullsLast()),
    index("Subscription_status_expiresAt_idx").using(
      "btree",
      table.status.asc().nullsLast(),
      table.expiresAt.asc().nullsLast(),
    ),
    index("Subscription_userId_idx").using("btree", table.userId.asc().nullsLast()),
    unique("Subscription_revenueCatId_key").on(table.revenueCatId),
  ],
);

export const subscriptionEventReceipt = pgTable(
  "SubscriptionEventReceipt",
  {
    /** 이 열을 추가하기 전에 처리한 이벤트는 null(알 수 없음)이다. */
    environment: subscriptionEnvironment(),
    eventId: varchar({ length: 255 }).notNull(),
    eventType: varchar({ length: 50 }).notNull(),
    processedAt: timestamp({ precision: 3 }).notNull(),
    provider: varchar({ length: 30 }).notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.provider, table.eventId], name: "SubscriptionEventReceipt_pkey" }),
  ],
);

export const premiumGrant = pgTable(
  "PremiumGrant",
  {
    createdAt: timestamp({ precision: 3 }).defaultNow().notNull(),
    durationDays: integer().notNull(),
    /** 진행 중에 끊고 남은 기간의 정확한 길이(ms). null이면 durationDays일이다. */
    durationMs: bigint({ mode: "number" }),
    endingNotifiedAt: timestamp({ precision: 3 }),
    endsAt: timestamp({ precision: 3 }),
    id: text().primaryKey().$defaultFn(createEntityId),
    source: premiumGrantSource().notNull(),
    sourceKey: varchar({ length: 128 }).notNull(),
    startsAt: timestamp({ precision: 3 }),
    status: premiumGrantStatus().notNull(),
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
      name: "PremiumGrant_userId_fkey",
    })
      .onUpdate("cascade")
      .onDelete("cascade"),
    index("PremiumGrant_status_endsAt_idx").using(
      "btree",
      table.status.asc().nullsLast(),
      table.endsAt.asc().nullsLast(),
    ),
    index("PremiumGrant_userId_status_idx").using(
      "btree",
      table.userId.asc().nullsLast(),
      table.status.asc().nullsLast(),
    ),
    unique("PremiumGrant_sourceKey_key").on(table.sourceKey),
  ],
);
