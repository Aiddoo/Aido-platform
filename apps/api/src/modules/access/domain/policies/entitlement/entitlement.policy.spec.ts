import { PLAN_CATALOG } from "@aido/api/vocabulary";

import {
  calculateRemainingLimit,
  NO_RESOURCE_BONUSES,
  resolveAccessContext,
  resolveAllFeatureAccess,
  resolveFeatureAccess,
  resolveQuotaLimit,
} from "./entitlement.policy.js";

const AT = new Date("2028-03-04T00:00:00.000Z");

describe("권한 정책 — 카탈로그와 접근 주체", () => {
  it.each([
    { role: "USER", subscriptionStatus: "ACTIVE", expected: { tier: "PREMIUM", isPremium: true } },
    { role: "USER", subscriptionStatus: "CANCELLED", expected: { tier: "FREE", isPremium: false } },
    { role: "ADMIN", subscriptionStatus: "FREE", expected: { tier: "ADMIN", isPremium: false } },
    { role: "ADMIN", subscriptionStatus: "ACTIVE", expected: { tier: "ADMIN", isPremium: true } },
  ])(
    "$role·$subscriptionStatus 사용자의 접근 주체는 $expected.tier다",
    ({ role, subscriptionStatus, expected }) => {
      // Given
      const state = { role, subscriptionStatus, accessDeadline: null };

      // When
      const context = resolveAccessContext(state, AT);

      // Then
      expect(context).toEqual(expected);
    },
  );

  it("끝나는 시각이 지난 ACTIVE는 tier와 isPremium이 함께 무료가 된다", () => {
    // Given
    const state = { role: "USER", subscriptionStatus: "ACTIVE", accessDeadline: AT };

    // When
    const context = resolveAccessContext(state, AT);

    // Then
    expect(context).toEqual({ tier: "FREE", isPremium: false });
  });

  it("ACTIVE 카테고리도 명시된 최대 보유량이 있으며 ADMIN만 무제한이다", () => {
    // When
    const premium = resolveFeatureAccess("PREMIUM", "TODO_CATEGORY", NO_RESOURCE_BONUSES);
    const admin = resolveFeatureAccess("ADMIN", "TODO_CATEGORY", NO_RESOURCE_BONUSES);

    // Then
    expect(premium.limit).toBe(PLAN_CATALOG.TODO_CATEGORY.premium);
    expect(admin.limit).toBeNull();
  });

  it("친구 자리 보너스는 무료 한도에 더하고 무제한에는 더하지 않는다", () => {
    // Given
    const bonuses = { FRIEND: 2 };

    // When
    const free = resolveFeatureAccess("FREE", "FRIEND", bonuses);
    const premium = resolveFeatureAccess("PREMIUM", "FRIEND", bonuses);

    // Then
    expect(free.limit).toBe(PLAN_CATALOG.FRIEND.free + 2);
    expect(premium.limit).toBeNull();
  });

  it("프리미엄 AI 정리는 무제한으로 보이지만 서버는 공정 사용 상한으로 막는다", () => {
    // When
    const displayed = resolveFeatureAccess("PREMIUM", "AI_PARSE", NO_RESOURCE_BONUSES);
    const enforced = resolveQuotaLimit("PREMIUM", "AI_PARSE");

    // Then
    expect(displayed.limit).toBeNull();
    expect(enforced).toEqual({ limit: PLAN_CATALOG.AI_PARSE.fairUse.premium, isFairUse: true });
  });

  it.each([
    { tier: "FREE" as const, expected: { limit: PLAN_CATALOG.AI_PARSE.free, isFairUse: false } },
    { tier: "ADMIN" as const, expected: { limit: null, isFairUse: false } },
  ])("$tier의 AI 정리 집행 한도는 $expected.limit이다", ({ tier, expected }) => {
    // When
    const limit = resolveQuotaLimit(tier, "AI_PARSE");

    // Then
    expect(limit).toEqual(expected);
  });

  it("응원처럼 상한 없는 프리미엄 quota는 정말 무제한이다", () => {
    // When
    const limit = resolveQuotaLimit("PREMIUM", "CHEER");

    // Then
    expect(limit).toEqual({ limit: null, isFairUse: false });
  });

  it("flag는 무료에서 꺼지고 프리미엄·ADMIN에서 켜지며 전체 권한은 카탈로그 순서다", () => {
    // When
    const free = resolveAllFeatureAccess("FREE", NO_RESOURCE_BONUSES);
    const admin = resolveAllFeatureAccess("ADMIN", NO_RESOURCE_BONUSES);

    // Then
    expect(Object.keys(free)).toEqual(Object.keys(PLAN_CATALOG));
    expect(free.AI_REPORT).toEqual({ allowed: false, limit: null });
    expect(admin.AI_REPORT).toEqual({ allowed: true, limit: null });
    expect(free.VOICE_NOTE).toEqual({ allowed: true, limit: PLAN_CATALOG.VOICE_NOTE.free });
  });

  it("무제한은 null을 유지하고 소진량이 한도를 넘으면 남은 횟수는 0이다", () => {
    // When
    const remaining = [calculateRemainingLimit(null, 100), calculateRemainingLimit(5, 6)];

    // Then
    expect(remaining).toEqual([null, 0]);
  });
});
