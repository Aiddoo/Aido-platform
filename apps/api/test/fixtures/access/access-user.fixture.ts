import {
  SUBSCRIPTION_STATUS,
  USER_ROLE,
  type AccessTier,
  type PlanFeature,
} from "@aido/api/vocabulary";

import {
  planOfTier,
  resolveFeatureEntitlements,
  type FeatureEntitlement,
} from "#api/modules/access/entitlements/domain/entitlement.domain-service";
import { NO_FEATURE_GRANTS } from "#api/modules/access/entitlements/domain/entitlements.constants";
import { instantFromDate } from "#api/shared/domain/time/instant";
import type { InMemoryAccessUser } from "#test/doubles/access/in-memory-access-state.reader";

export const ACCESS_FIXTURE_NOW = Temporal.Instant.from("2026-04-12T12:00:00Z");
export const ACCESS_FIXTURE_USER_ID = "clz7x5p8k0011qz0z8z8z8z8z";
export const ACCESS_FIXTURE_OTHER_USER_ID = "clz7x5p8k0012qz0z8z8z8z8z";

type InstantInput = Date | Temporal.Instant;

/**
 * 권한·원장 대역의 사용자 행 입력. 다른 Context의 옛 spec이 문자열 상태와 Date를 넘기므로 넓게 받는다.
 * 모르는 구독 상태는 무료다.
 */
export interface AccessUserInput {
  readonly role?: string;
  readonly subscriptionStatus?: string;
  readonly accessDeadline?: InstantInput | null;
  readonly isActive?: boolean;
  readonly aiUsageCount?: number;
  readonly aiUsageResetAt?: InstantInput;
}

function toInstant(value: InstantInput): Temporal.Instant {
  return value instanceof Date ? instantFromDate(value) : value;
}

/** 이번 달 AI 사용 0회인 활성 무료 사용자 */
export function createAccessUserFixture(input: AccessUserInput = {}): InMemoryAccessUser {
  return {
    role: input.role === USER_ROLE.ADMIN ? USER_ROLE.ADMIN : USER_ROLE.USER,
    subscriptionStatus:
      SUBSCRIPTION_STATUS.find((status) => status === input.subscriptionStatus) ?? "FREE",
    accessDeadline: input.accessDeadline == null ? null : toInstant(input.accessDeadline),
    isActive: input.isActive ?? true,
    aiUsageCount: input.aiUsageCount ?? 0,
    aiUsageResetAt: toInstant(input.aiUsageResetAt ?? ACCESS_FIXTURE_NOW),
  };
}

/** 받은 자리 없는 주체의 모든 기능. 다른 Context 대역이 실제 Access 판단으로 권한을 채울 때 쓴다 */
export function createFeatureEntitlementsFixture(
  tier: AccessTier,
): Record<PlanFeature, FeatureEntitlement> {
  return resolveFeatureEntitlements({ plan: planOfTier(tier), grants: NO_FEATURE_GRANTS });
}
