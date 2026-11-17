import type { SubscriptionStatus } from "@aido/api/vocabulary";
import { and, eq, exists, gt, inArray, isNull, or, sql, type SQL } from "drizzle-orm";
import { QueryBuilder, type AnyPgColumn } from "drizzle-orm/pg-core";

import { subscription } from "#api/platform/database/schema/billing.schema";
import { instantFromDate } from "#api/shared/domain/time/instant";

import { storeRenewalCutoff } from "../../../shared/domain/store-renewal-grace.domain-service.js";

interface StoreEntitlementColumns {
  readonly status: AnyPgColumn;
  readonly expiresAt: AnyPgColumn;
  readonly gracePeriodEndsAt: AnyPgColumn;
}

const ENTITLED_STORE_STATUSES: SubscriptionStatus[] = ["ACTIVE", "CANCELLED"];

/**
 * storeEntitlementEndsAt(store-renewal-grace)와 같은 규칙: 자동 갱신 중이면 만료 뒤 웹훅 대기 유예까지,
 * 취소했으면 만료 전까지, 결제 유예 중이면 그 끝까지 유효하다. 규칙을 바꾸면 두 곳을 함께 바꾼다.
 */
export function validStoreEntitlementCondition(store: StoreEntitlementColumns, at: Date): SQL {
  // 구독 테이블의 시간 칸은 Temporal 칸이라 비교 값도 Instant로 건넨다
  const instantAt = instantFromDate(at);
  return sql`(${or(
    and(eq(store.status, "ACTIVE"), gt(store.expiresAt, storeRenewalCutoff(instantAt))),
    and(eq(store.status, "CANCELLED"), gt(store.expiresAt, instantAt)),
    and(inArray(store.status, ENTITLED_STORE_STATUSES), gt(store.gracePeriodEndsAt, instantAt)),
  )})`;
}

/** 이 사용자 칸이 소유한, 지우지 않은 스토어 구독 중 엔타이틀먼트가 남은 행이 있다. */
export function storeEntitlementExistsCondition(userId: AnyPgColumn, at: Date): SQL {
  return exists(
    new QueryBuilder()
      .select({ one: sql`1` })
      .from(subscription)
      .where(
        and(
          eq(subscription.userId, userId),
          isNull(subscription.deletedAt),
          validStoreEntitlementCondition(subscription, at),
        ),
      ),
  );
}

/**
 * 사용자 조회에 붙이는 subscriptions 관계 조건. 엔타이틀먼트 끝 판단(storeEntitlementEndsAt)에 필요한 칸을
 * 지우지 않은 ACTIVE·CANCELLED 행에서만 읽는다.
 */
export const storeEntitlementWindowsQuery = {
  columns: { status: true, expiresAt: true, gracePeriodEndsAt: true },
  where: { status: { in: ENTITLED_STORE_STATUSES }, deletedAt: { isNull: true } },
} as const;
