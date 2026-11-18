import { and, eq, gt, isNull, or, sql, type SQL } from "drizzle-orm";

import { storeEntitlementExistsCondition } from "#api/modules/billing/subscriptions/billing-subscriptions.public";
import type { UserAccessColumns } from "#api/modules/identity/users/identity-users-queries.public";
import { instantFromDate } from "#api/shared/domain/time/instant";

/**
 * paid-access.domain-service의 hasPaidAccess(resolvePaidAccessDeadline 포함)를 여러 사용자를 한 번에 고르는
 * SQL 조건으로 표현한다. User projection이 ACTIVE이고, 만료 시각이 없거나(웹훅이 바꿀 때까지 유지)
 * projection 만료 시각 또는 옮겨 가지 않은 스토어 구독의 엔타이틀먼트 끝이 아직 지나지 않았다.
 * 두 규칙은 premium-access-condition integration의 parity 테스트로 묶여 있다.
 */
export function activeSubscriptionCondition(target: UserAccessColumns, at: Date): SQL {
  const validStore = storeEntitlementExistsCondition(target.id, at);
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
export function premiumAccessCondition(target: UserAccessColumns, at: Date): SQL {
  return sql`(${or(eq(target.role, "ADMIN"), activeSubscriptionCondition(target, at))})`;
}

/** premiumAccessCondition의 반대. 두 조건은 NULL 없이 사용자를 정확히 둘로 나눈다. */
export function freeAccessCondition(target: UserAccessColumns, at: Date): SQL {
  return sql`not ${premiumAccessCondition(target, at)}`;
}
