import {
  SUBSCRIPTION_AI_PARSE_LIMITS,
  SUBSCRIPTION_TODO_CATEGORY_LIMITS,
} from "@aido/api/vocabulary";

import {
  calculateRemainingLimit,
  Feature,
  hasPremiumEntitlement,
  Resource,
  resolveFeatureLimit,
  resolveResourceLimit,
} from "./entitlement-limits.policy.js";

describe("Entitlement 순수 정책 — 미지 상태와 무제한 구분", () => {
  it.each(["UNKNOWN", "toString", "__proto__"])(
    "구독 상태 %s는 무료 한도로 제한한다",
    (subscriptionStatus) => {
      // Given / When
      const limit = resolveFeatureLimit("USER", subscriptionStatus, Feature.AI_PARSE);
      // Then
      expect(limit).toBe(SUBSCRIPTION_AI_PARSE_LIMITS.FREE);
      expect(hasPremiumEntitlement("USER", subscriptionStatus)).toBe(false);
    },
  );

  it("ACTIVE 카테고리도 명시된 최대 보유량이 있으며 ADMIN만 무제한이다", () => {
    // Given / When
    const activeLimit = resolveResourceLimit("USER", "ACTIVE", Resource.CATEGORY);
    const adminLimit = resolveResourceLimit("ADMIN", "FREE", Resource.CATEGORY);
    // Then
    expect(activeLimit).toBe(SUBSCRIPTION_TODO_CATEGORY_LIMITS.ACTIVE);
    expect(adminLimit).toBeNull();
  });

  it("무제한은 null을 유지하고 소진량이 한도를 넘으면 남은 횟수는 0이다", () => {
    // Given / When / Then
    expect(calculateRemainingLimit(null, 100)).toBeNull();
    expect(calculateRemainingLimit(5, 6)).toBe(0);
  });
});
