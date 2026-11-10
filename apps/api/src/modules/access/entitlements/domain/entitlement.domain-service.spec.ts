import { PLAN_CATALOG } from "@aido/api/vocabulary";

import {
  calculateRemainingLimit,
  isExemptFromDormancy,
  resolveAccessTier,
  resolveAllFeatureAccess,
  resolveFeatureAccess,
  resolveFeatureQuota,
  resolvePerUseLimit,
  resolveQuotaLimit,
} from "./entitlement.domain-service.js";
import { NO_RESOURCE_BONUSES } from "./entitlements.constants.js";

const AT = Temporal.Instant.from("2028-03-04T00:00:00.000Z");

describe("isExemptFromDormancy", () => {
  it.each([
    { tier: "FREE", exempt: false },
    { tier: "PREMIUM", exempt: true },
    { tier: "ADMIN", exempt: true },
  ] as const)("$tier 휴면 제외는 $exempt다", ({ tier, exempt }) => {
    // When
    const result = isExemptFromDormancy(tier);
    // Then
    expect(result).toBe(exempt);
  });
});

describe("권한 정책 — 카탈로그와 접근 주체", () => {
  it.each([
    { role: "USER", subscriptionStatus: "ACTIVE", expected: { tier: "PREMIUM", isPremium: true } },
    { role: "USER", subscriptionStatus: "CANCELLED", expected: { tier: "FREE", isPremium: false } },
    { role: "ADMIN", subscriptionStatus: "FREE", expected: { tier: "ADMIN", isPremium: false } },
    { role: "ADMIN", subscriptionStatus: "ACTIVE", expected: { tier: "ADMIN", isPremium: true } },
  ] as const)(
    "$role·$subscriptionStatus 사용자의 접근 주체는 $expected.tier다",
    ({ role, subscriptionStatus, expected }) => {
      // Given
      const state = { role, subscriptionStatus, accessDeadline: null };

      // When
      const context = resolveAccessTier({ state, now: AT });

      // Then
      expect(context).toEqual(expected);
    },
  );

  it("끝나는 시각이 지난 ACTIVE는 tier와 isPremium이 함께 무료가 된다", () => {
    // Given
    const state = { role: "USER", subscriptionStatus: "ACTIVE", accessDeadline: AT } as const;

    // When
    const context = resolveAccessTier({ state, now: AT });

    // Then
    expect(context).toEqual({ tier: "FREE", isPremium: false });
  });

  it("ACTIVE 카테고리도 명시된 최대 보유량이 있으며 ADMIN만 무제한이다", () => {
    // When
    const premium = resolveFeatureAccess({
      tier: "PREMIUM",
      feature: "TODO_CATEGORY",
      resourceBonuses: NO_RESOURCE_BONUSES,
    });
    const admin = resolveFeatureAccess({
      tier: "ADMIN",
      feature: "TODO_CATEGORY",
      resourceBonuses: NO_RESOURCE_BONUSES,
    });

    // Then
    expect(premium.limit).toBe(PLAN_CATALOG.TODO_CATEGORY.premium);
    expect(admin.limit).toBeNull();
  });

  it("친구 자리 보너스는 무료 한도에 더하고 무제한에는 더하지 않는다", () => {
    // Given
    const bonuses = { FRIEND: 2 };

    // When
    const free = resolveFeatureAccess({
      tier: "FREE",
      feature: "FRIEND",
      resourceBonuses: bonuses,
    });
    const premium = resolveFeatureAccess({
      tier: "PREMIUM",
      feature: "FRIEND",
      resourceBonuses: bonuses,
    });

    // Then
    expect(free.limit).toBe(PLAN_CATALOG.FRIEND.free + 2);
    expect(premium.limit).toBeNull();
  });

  it("프리미엄 AI 정리는 무제한으로 보이지만 서버는 공정 사용 상한으로 막는다", () => {
    // When
    const displayed = resolveFeatureAccess({
      tier: "PREMIUM",
      feature: "AI_PARSE",
      resourceBonuses: NO_RESOURCE_BONUSES,
    });
    const enforced = resolveQuotaLimit({ tier: "PREMIUM", feature: "AI_PARSE" });

    // Then
    expect(displayed.limit).toBeNull();
    expect(enforced).toEqual({ limit: PLAN_CATALOG.AI_PARSE.fairUse.premium, isFairUse: true });
  });

  it.each([
    { tier: "FREE" as const, expected: { limit: PLAN_CATALOG.AI_PARSE.free, isFairUse: false } },
    { tier: "ADMIN" as const, expected: { limit: null, isFairUse: false } },
  ])("$tier의 AI 정리 집행 한도는 $expected.limit이다", ({ tier, expected }) => {
    // When
    const limit = resolveQuotaLimit({ tier, feature: "AI_PARSE" });

    // Then
    expect(limit).toEqual(expected);
  });

  it("응원처럼 상한 없는 프리미엄 quota는 정말 무제한이다", () => {
    // When
    const limit = resolveQuotaLimit({ tier: "PREMIUM", feature: "CHEER" });

    // Then
    expect(limit).toEqual({ limit: null, isFairUse: false });
  });

  it("flag는 무료에서 꺼지고 프리미엄·ADMIN에서 켜지며 전체 권한은 카탈로그 순서다", () => {
    // When
    const free = resolveAllFeatureAccess({ tier: "FREE", resourceBonuses: NO_RESOURCE_BONUSES });
    const admin = resolveAllFeatureAccess({ tier: "ADMIN", resourceBonuses: NO_RESOURCE_BONUSES });

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

  it.each([
    {
      tier: "FREE",
      used: PLAN_CATALOG.VOICE_NOTE.free + 1,
      expected: {
        limit: PLAN_CATALOG.VOICE_NOTE.free,
        remaining: 0,
        isFairUse: false,
        perUse: {
          maxSeconds: PLAN_CATALOG.VOICE_NOTE.perUse.maxSeconds.free,
          maxCharacters: PLAN_CATALOG.VOICE_NOTE.perUse.maxCharacters.free,
        },
      },
    },
    {
      tier: "PREMIUM",
      used: 3,
      expected: {
        limit: PLAN_CATALOG.VOICE_NOTE.fairUse.premium,
        remaining: PLAN_CATALOG.VOICE_NOTE.fairUse.premium - 3,
        isFairUse: true,
        perUse: {
          maxSeconds: PLAN_CATALOG.VOICE_NOTE.perUse.maxSeconds.premium,
          maxCharacters: PLAN_CATALOG.VOICE_NOTE.perUse.maxCharacters.premium,
        },
      },
    },
    {
      tier: "ADMIN",
      used: 3,
      expected: {
        limit: null,
        remaining: null,
        isFairUse: false,
        perUse: {
          maxSeconds: PLAN_CATALOG.VOICE_NOTE.perUse.maxSeconds.premium,
          maxCharacters: PLAN_CATALOG.VOICE_NOTE.perUse.maxCharacters.premium,
        },
      },
    },
  ] as const)(
    "$tier 녹음 정리 featureQuota는 집행 한도·남은 횟수·길이 상한을 서버가 계산한다",
    ({ tier, used, expected }) => {
      // Given
      const resetsAt = Temporal.Instant.from("2028-03-31T15:00:00.000Z");

      // When
      const quota = resolveFeatureQuota({
        tier,
        feature: "VOICE_NOTE",
        resourceBonuses: NO_RESOURCE_BONUSES,
        usage: { used, resetsAt },
      });

      // Then
      expect(quota).toEqual({
        feature: "VOICE_NOTE",
        allowed: true,
        used,
        period: "month",
        resetsAt,
        ...expected,
      });
    },
  );

  it("사용량을 세지 않는 resource·flag는 used·period·resetsAt이 null이고 보너스를 더한 한도를 쓴다", () => {
    // When
    const friend = resolveFeatureQuota({
      tier: "FREE",
      feature: "FRIEND",
      resourceBonuses: { FRIEND: 2 },
      usage: null,
    });
    const report = resolveFeatureQuota({
      tier: "FREE",
      feature: "AI_REPORT",
      resourceBonuses: NO_RESOURCE_BONUSES,
      usage: null,
    });

    // Then
    expect(friend).toMatchObject({
      allowed: true,
      limit: PLAN_CATALOG.FRIEND.free + 2,
      used: null,
      remaining: null,
      period: null,
      resetsAt: null,
      perUse: null,
    });
    expect(report).toMatchObject({ allowed: false, limit: null, used: null, period: null });
  });

  it("한도 오류에서 센 resource 개수는 used·remaining에 싣고 다시 채워지지 않아 resetsAt은 null이다", () => {
    // Given
    const limit = PLAN_CATALOG.FRIEND.free + 1;

    // When
    const friend = resolveFeatureQuota({
      tier: "FREE",
      feature: "FRIEND",
      resourceBonuses: { FRIEND: 1 },
      usage: { used: limit, resetsAt: null },
    });

    // Then
    expect(friend).toMatchObject({
      limit,
      used: limit,
      remaining: 0,
      period: null,
      resetsAt: null,
    });
  });

  it("길이 상한이 없는 기능은 perUse가 null이다", () => {
    // When
    const perUse = resolvePerUseLimit({ tier: "PREMIUM", feature: "AI_PARSE" });

    // Then
    expect(perUse).toBeNull();
  });
});
