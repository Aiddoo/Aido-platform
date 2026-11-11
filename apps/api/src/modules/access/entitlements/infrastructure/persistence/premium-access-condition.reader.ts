import { and, eq, exists, gt, inArray, isNull, or, sql, type SQL } from "drizzle-orm";
import { QueryBuilder, type AnyPgColumn } from "drizzle-orm/pg-core";

import { storeRenewalCutoff } from "#api/modules/billing/subscriptions/billing-subscriptions-entitlement.public";
import { subscription, type user } from "#api/platform/database/schema/index";
import { instantFromDate } from "#api/shared/domain/time/instant";

type PremiumUserColumns = Pick<
  typeof user,
  "id" | "role" | "subscriptionStatus" | "subscriptionExpiresAt"
>;

export interface StoreEntitlementColumns {
  readonly status: AnyPgColumn;
  readonly expiresAt: AnyPgColumn;
  readonly gracePeriodEndsAt: AnyPgColumn;
}

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
    and(inArray(store.status, ["ACTIVE", "CANCELLED"]), gt(store.gracePeriodEndsAt, instantAt)),
  )})`;
}

/**
 * paid-access.domain-service의 hasPaidAccess(resolvePaidAccessDeadline 포함)를 여러 사용자를 한 번에 고르는
 * SQL 조건으로 표현한다. User projection이 ACTIVE이고, 만료 시각이 없거나(웹훅이 바꿀 때까지 유지)
 * projection 만료 시각 또는 옮겨 가지 않은 스토어 구독의 엔타이틀먼트 끝이 아직 지나지 않았다.
 * 두 규칙은 premium-access-condition integration의 parity 테스트로 묶여 있다.
 */
export function activeSubscriptionCondition(target: PremiumUserColumns, at: Date): SQL {
  const validStore = exists(
    new QueryBuilder()
      .select({ one: sql`1` })
      .from(subscription)
      .where(
        and(
          eq(subscription.userId, target.id),
          isNull(subscription.deletedAt),
          validStoreEntitlementCondition(subscription, at),
        ),
      ),
  );
  return sql`(${and(
    eq(target.subscriptionStatus, "ACTIVE"),
    or(
      isNull(target.subscriptionExpiresAt),
      gt(target.subscriptionExpiresAt, instantFromDate(at)),
      validStore,
    ),
  )})`;
}

/** resolveAccessSubject의 plan이 premium인 사용자: ADMIN이거나 유효한 유료 구독이 있다. */
export function premiumAccessCondition(target: PremiumUserColumns, at: Date): SQL {
  return sql`(${or(eq(target.role, "ADMIN"), activeSubscriptionCondition(target, at))})`;
}

/** premiumAccessCondition의 반대. 두 조건은 NULL 없이 사용자를 정확히 둘로 나눈다. */
export function freeAccessCondition(target: PremiumUserColumns, at: Date): SQL {
  return sql`not ${premiumAccessCondition(target, at)}`;
}
