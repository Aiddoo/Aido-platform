import type { SubscriptionStatus } from "@aido/api/vocabulary";
import { maxBy } from "es-toolkit";

import {
  storeEntitlementEndsAt,
  type StoreEntitlementWindow,
} from "#api/modules/billing/subscriptions/billing-subscriptions-entitlement.public";

/** User 구독 projection과 그 projection이 끝나는 시각 */
export interface PaidAccessState {
  readonly subscriptionStatus: SubscriptionStatus;
  /** ACTIVE projection이 끝나는 시각. null이면 웹훅이 상태를 바꿀 때까지 유지한다. */
  readonly accessDeadline: Temporal.Instant | null;
}

/**
 * 유효한 스토어 구독이나 보상 기간이 있는지. 권한 주체·/me isPremium·SQL activeSubscriptionCondition이 모두
 * 이 규칙 하나를 따른다. 끝나는 시각이 지난 ACTIVE projection은 정리 작업이 돌기 전이라도 무료로 본다.
 */
export function hasPaidAccess(params: {
  readonly state: PaidAccessState;
  readonly now: Temporal.Instant;
}): boolean {
  const { state, now } = params;
  return (
    state.subscriptionStatus === "ACTIVE" &&
    (state.accessDeadline == null || Temporal.Instant.compare(state.accessDeadline, now) > 0)
  );
}

/**
 * User projection이 ACTIVE여도 프리미엄이 끝나는 시각.
 * 보상 기간은 projection의 만료 시각에 정확히 끝나고, 스토어 구독은 storeEntitlementEndsAt(웹훅 대기
 * 유예·결제 유예 포함)까지 이어진다. 만료 시각이 없으면 웹훅이 상태를 바꿀 때까지 유지하던 기존 동작을 따른다.
 */
export function resolvePaidAccessDeadline(params: {
  readonly subscriptionExpiresAt: Temporal.Instant | null;
  /** 다른 사용자에게 옮겨 가지 않은 ACTIVE·CANCELLED 스토어 구독 행 */
  readonly storeEntitlements: readonly StoreEntitlementWindow[];
}): Temporal.Instant | null {
  const { subscriptionExpiresAt } = params;
  if (subscriptionExpiresAt == null) {
    return null;
  }
  return (
    maxBy(
      [
        subscriptionExpiresAt,
        ...params.storeEntitlements.flatMap((store) => storeEntitlementEndsAt(store) ?? []),
      ],
      (instant) => instant.epochMilliseconds,
    ) ?? subscriptionExpiresAt
  );
}
