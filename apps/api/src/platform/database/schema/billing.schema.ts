import { sql } from "drizzle-orm";
import {
  bigint,
  pgTable,
  integer,
  text,
  varchar,
  serial,
  index,
  foreignKey,
  primaryKey,
  unique,
} from "drizzle-orm/pg-core";

import { createEntityId } from "../../../shared/domain/model/entity-id.js";
import { instant } from "../columns/temporal-columns.js";
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
    cancelledAt: instant(),
    createdAt: instant()
      .default(sql`now()`)
      .notNull(),
    // DB에는 dataRetentionUntil이 남아 있다(1.15.1 이미지가 SELECT). 1.16.0에서 지운다(compatibility.md)
    deletedAt: instant(),
    /** 구매 웹훅의 결제 환경. 이 열을 추가하기 전에 만든 행은 null(알 수 없음)이다. */
    environment: subscriptionEnvironment(),
    expiresAt: instant().notNull(),
    /** BILLING_ISSUE가 알려 준 스토어 결제 유예의 끝. 그때까지 엔타이틀먼트가 남고 RENEWAL·EXPIRATION이 지운다. */
    gracePeriodEndsAt: instant(),
    id: serial().primaryKey(),
    lastProcessedEventId: varchar({ length: 255 }),
    /** PRODUCT_CHANGE가 예약한 다음 갱신의 상품(new_product_id). 실제 결제·재개 이벤트가 productId로 옮기고 비운다. */
    nextProductId: varchar({ length: 100 }),
    /** 지금 기간의 RevenueCat period_type(STORE_PERIOD_TYPES). 이 열을 추가하기 전에 만든 행은 null = NORMAL이다. */
    periodType: text(),
    productId: varchar({ length: 100 }).notNull(),
    /** 연간 갱신 7일 전 안내를 보낸 기간의 expiresAt. 갱신으로 expiresAt이 바뀌면 다음 기간에 다시 보낸다. */
    renewalNoticeExpiresAt: instant(),
    startedAt: instant().notNull(),
    status: subscriptionStatus().notNull(),
    /** 스토어 체인 키(원 거래 ID). 공급자 중립 이름이고 칼럼은 운영 데이터 호환을 위해 기존 이름을 유지한다. */
    storeSubscriptionId: varchar("revenueCatId", { length: 255 }).notNull(),
    /** 무료 체험 종료 3일 전 안내를 보낸 시각. 조건부 UPDATE로 체인마다 한 번만 보낸다. */
    trialEndingNotifiedAt: instant({ withTimezone: true }),
    // 도메인이 ClockPort 값으로 채운다. 집합 update도 저장소가 명시한다
    updatedAt: instant().notNull(),
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
    // 체험 종료 안내 sweep이 아직 알리지 않은 체험만 끝나는 순서로 읽는다
    index("Subscription_trial_ending_notice_idx")
      .using("btree", table.expiresAt.asc().nullsLast(), table.id.asc().nullsLast())
      .where(sql`${table.periodType} = 'TRIAL' AND ${table.trialEndingNotifiedAt} IS NULL`),
    unique("Subscription_revenueCatId_key").on(table.storeSubscriptionId),
  ],
);

export const subscriptionEventReceipt = pgTable(
  "SubscriptionEventReceipt",
  {
    /** 이 열을 추가하기 전에 처리한 이벤트는 null(알 수 없음)이다. */
    environment: subscriptionEnvironment(),
    eventId: varchar({ length: 255 }).notNull(),
    eventType: varchar({ length: 50 }).notNull(),
    processedAt: instant().notNull(),
    provider: varchar({ length: 30 }).notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.provider, table.eventId], name: "SubscriptionEventReceipt_pkey" }),
  ],
);

export const premiumGrant = pgTable(
  "PremiumGrant",
  {
    createdAt: instant()
      .default(sql`now()`)
      .notNull(),
    durationDays: integer().notNull(),
    /** 진행 중에 끊고 남은 기간의 정확한 길이(ms). null이면 durationDays일이다. */
    durationMs: bigint({ mode: "number" }),
    endingNotifiedAt: instant(),
    endsAt: instant(),
    id: text().primaryKey().$defaultFn(createEntityId),
    source: premiumGrantSource().notNull(),
    sourceKey: varchar({ length: 128 }).notNull(),
    startsAt: instant(),
    status: premiumGrantStatus().notNull(),
    // 도메인이 ClockPort 값으로 채운다. 집합 update도 저장소가 명시한다
    updatedAt: instant().notNull(),
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
