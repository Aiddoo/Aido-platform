import {
  SUBSCRIPTION_AI_PARSE_LIMITS,
  SUBSCRIPTION_TODO_CATEGORY_LIMITS,
} from "@aido/api/vocabulary";

import {
  calculateRemainingLimit,
  Feature,
  hasPremiumEntitlement,
  Resource,
  resolveEffectiveSubscriptionStatus,
  resolveFeatureLimit,
  resolvePremiumAccessDeadline,
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

  describe("프리미엄 종료 시각", () => {
    const ENDS_AT = new Date("2028-03-04T00:00:00.000Z");

    it.each([
      { now: "2028-03-03T23:59:59.999Z", expected: "ACTIVE" },
      { now: "2028-03-04T00:00:00.000Z", expected: "EXPIRED" },
    ])("보상 기간만 있으면 $now에 $expected로 본다", ({ now, expected }) => {
      // Given
      const deadline = resolvePremiumAccessDeadline({
        subscriptionExpiresAt: ENDS_AT,
        renewingStoreExpiresAt: [],
      });

      // When
      const status = resolveEffectiveSubscriptionStatus("ACTIVE", deadline, new Date(now));

      // Then
      expect(status).toBe(expected);
    });

    it("자동 갱신 중인 스토어 구독은 만료 뒤 3시간 유예가 끝날 때까지 프리미엄이다", () => {
      // Given
      const deadline = resolvePremiumAccessDeadline({
        subscriptionExpiresAt: ENDS_AT,
        renewingStoreExpiresAt: [ENDS_AT],
      });

      // When
      const statuses = [
        resolveEffectiveSubscriptionStatus(
          "ACTIVE",
          deadline,
          new Date("2028-03-04T02:59:59.999Z"),
        ),
        resolveEffectiveSubscriptionStatus(
          "ACTIVE",
          deadline,
          new Date("2028-03-04T03:00:00.000Z"),
        ),
      ];

      // Then
      expect(statuses).toEqual(["ACTIVE", "EXPIRED"]);
    });

    it("만료 시각이 없는 projection과 ACTIVE가 아닌 상태는 그대로 둔다", () => {
      // Given
      const deadline = resolvePremiumAccessDeadline({
        subscriptionExpiresAt: null,
        renewingStoreExpiresAt: [ENDS_AT],
      });

      // When
      const statuses = [
        resolveEffectiveSubscriptionStatus(
          "ACTIVE",
          deadline,
          new Date("2030-01-01T00:00:00.000Z"),
        ),
        resolveEffectiveSubscriptionStatus("FREE", ENDS_AT, new Date("2030-01-01T00:00:00.000Z")),
      ];

      // Then
      expect(deadline).toBeNull();
      expect(statuses).toEqual(["ACTIVE", "FREE"]);
    });
  });
});
