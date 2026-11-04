import { maxBy } from "es-toolkit";

import {
  storeEntitlementEndsAt,
  type StoreEntitlementWindow,
} from "#api/shared/domain/store-renewal-grace";

/** User 구독 projection과 그 projection이 끝나는 시각 */
export interface PaidAccessState {
  readonly subscriptionStatus: string;
  /** ACTIVE projection이 끝나는 시각. null이면 웹훅이 상태를 바꿀 때까지 유지한다. */
  readonly accessDeadline: Date | null;
}

/**
 * 유효한 스토어 구독이나 보상 기간이 있는지. 등급(tier)·/me isPremium·SQL premiumAccessCondition이 모두 이
 * 규칙 하나를 따른다. 끝나는 시각이 지난 ACTIVE projection은 정리 작업이 돌기 전이라도 무료로 본다.
 */
export function hasPaidAccess(state: PaidAccessState, at: Date): boolean {
  return (
    state.subscriptionStatus === "ACTIVE" &&
    (state.accessDeadline == null || state.accessDeadline.getTime() > at.getTime())
  );
}

export interface PremiumAccessDeadlineInput {
  readonly subscriptionExpiresAt: Date | null;
  /** 다른 사용자에게 옮겨 가지 않은 ACTIVE·CANCELLED 스토어 구독 행 */
  readonly storeEntitlements: readonly StoreEntitlementWindow[];
}

/**
 * User projection이 ACTIVE여도 프리미엄이 끝나는 시각.
 * 보상 기간은 projection의 만료 시각에 정확히 끝나고, 스토어 구독은 storeEntitlementEndsAt(웹훅 대기
 * 유예·결제 유예 포함)까지 이어진다. 만료 시각이 없으면 웹훅이 상태를 바꿀 때까지 유지하던 기존 동작을 따른다.
 */
export function resolvePremiumAccessDeadline(input: PremiumAccessDeadlineInput): Date | null {
  const { subscriptionExpiresAt } = input;
  if (subscriptionExpiresAt == null) {
    return null;
  }
  return (
    maxBy(
      [
        subscriptionExpiresAt,
        ...input.storeEntitlements.flatMap((store) => storeEntitlementEndsAt(store) ?? []),
      ],
      (date) => date.getTime(),
    ) ?? subscriptionExpiresAt
  );
}
