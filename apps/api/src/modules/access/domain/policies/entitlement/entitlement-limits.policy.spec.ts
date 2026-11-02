import { PREMIUM_FEATURES } from "@aido/api/vocabulary";

import {
  calculateRemainingLimit,
  Feature,
  Resource,
  resolveAccessTier,
  resolveEffectiveSubscriptionStatus,
  resolveFeatureLimit,
  resolvePremiumAccessDeadline,
  resolveResourceLimit,
  toSubscriptionStatus,
} from "./entitlement-limits.policy.js";

describe("Entitlement 순수 정책 — 미지 상태와 무제한 구분", () => {
  it.each(["UNKNOWN", "toString", "__proto__"])(
    "구독 상태 %s는 무료 한도로 제한한다",
    (subscriptionStatus) => {
      // Given / When
      const limit = resolveFeatureLimit("USER", subscriptionStatus, Feature.AI_PARSE);
      // Then
      expect(limit).toBe(PREMIUM_FEATURES.AI_PARSE.free);
      expect(resolveAccessTier("USER", subscriptionStatus)).toBe("FREE");
    },
  );

  it("ACTIVE 카테고리도 명시된 최대 보유량이 있으며 ADMIN만 무제한이다", () => {
    // Given / When
    const activeLimit = resolveResourceLimit("USER", "ACTIVE", Resource.CATEGORY, 0);
    const adminLimit = resolveResourceLimit("ADMIN", "FREE", Resource.CATEGORY, 0);
    // Then
    expect(activeLimit).toBe(PREMIUM_FEATURES.TODO_CATEGORY.premium);
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
        storeEntitlements: [],
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
        storeEntitlements: [{ status: "ACTIVE", expiresAt: ENDS_AT }],
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

    it("결제 유예 중인 스토어 구독은 취소 상태여도 유예가 끝날 때까지 프리미엄이다", () => {
      // Given
      const graceEndsAt = new Date("2028-03-14T00:00:00.000Z");
      const deadline = resolvePremiumAccessDeadline({
        subscriptionExpiresAt: ENDS_AT,
        storeEntitlements: [
          { status: "CANCELLED", expiresAt: ENDS_AT, gracePeriodEndsAt: graceEndsAt },
        ],
      });

      // When
      const statuses = [
        resolveEffectiveSubscriptionStatus("ACTIVE", deadline, new Date(graceEndsAt.getTime() - 1)),
        resolveEffectiveSubscriptionStatus("ACTIVE", deadline, graceEndsAt),
      ];

      // Then
      expect(statuses).toEqual(["ACTIVE", "EXPIRED"]);
    });

    it("만료 시각이 없는 projection과 ACTIVE가 아닌 상태는 그대로 둔다", () => {
      // Given
      const deadline = resolvePremiumAccessDeadline({
        subscriptionExpiresAt: null,
        storeEntitlements: [{ status: "ACTIVE", expiresAt: ENDS_AT }],
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

  it("친구 자리 보너스는 무료 한도에 더하고 무제한에는 더하지 않는다", () => {
    // Given
    const bonus = 2;

    // When
    const freeLimit = resolveResourceLimit("USER", "FREE", Resource.FRIEND, bonus);
    const adminLimit = resolveResourceLimit("ADMIN", "FREE", Resource.FRIEND, bonus);

    // Then
    expect(freeLimit).toBe(PREMIUM_FEATURES.FRIEND.free + bonus);
    expect(adminLimit).toBeNull();
  });

  it.each([
    { role: "USER" as const, status: "ACTIVE" as const, expected: null },
    { role: "ADMIN" as const, status: "ACTIVE" as const, expected: null },
    {
      role: "USER" as const,
      status: "CANCELLED" as const,
      expected: PREMIUM_FEATURES.FRIEND.free + 2,
    },
    {
      role: "USER" as const,
      status: "EXPIRED" as const,
      expected: PREMIUM_FEATURES.FRIEND.free + 2,
    },
  ])(
    "$role·$status 사용자의 친구 자리 보너스 2개를 더한 한도는 $expected다",
    ({ role, status, expected }) => {
      // Given
      const bonus = 2;

      // When
      const limit = resolveResourceLimit(role, status, Resource.FRIEND, bonus);

      // Then
      expect(limit).toBe(expected);
    },
  );

  it.each([
    { value: "CANCELLED", expected: "CANCELLED" },
    { value: "TRIAL", expected: "FREE" },
  ])("저장된 구독 상태 $value는 $expected로 읽는다", ({ value, expected }) => {
    // Given
    const stored = value;

    // When
    const status = toSubscriptionStatus(stored);

    // Then
    expect(status).toBe(expected);
  });
});
