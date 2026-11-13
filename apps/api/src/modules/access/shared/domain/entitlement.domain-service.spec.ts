import { ACCESS_TIERS, PLAN_CATALOG, PLANS } from "@aido/api/vocabulary";

import { NO_FEATURE_GRANTS } from "./access.constants.js";
import {
  calculateRemainingLimit,
  isExemptFromDormancy,
  planOfTier,
  resolveAccessSubject,
  resolveFeatureEntitlement,
  resolveFeatureEntitlements,
  resolveFeatureLimit,
  resolveFeatureQuota,
  resolvePerUseLimit,
  resolveQuotaLimit,
  resolveResourceUsage,
} from "./entitlement.domain-service.js";

const AT = Temporal.Instant.from("2028-03-04T00:00:00.000Z");

describe("isExemptFromDormancy", () => {
  it.each([
    { plan: "free", exempt: false },
    { plan: "premium", exempt: true },
  ] as const)("$plan 요금제의 휴면 제외는 $exempt다", ({ plan, exempt }) => {
    // When
    const result = isExemptFromDormancy(plan);
    // Then
    expect(result).toBe(exempt);
  });
});

describe("권한 주체와 요금제", () => {
  it("ADMIN 주체는 프리미엄 요금제를 받고 무료 주체만 무료 요금제다", () => {
    // When
    const plans = ACCESS_TIERS.map((tier) => [tier, planOfTier(tier)]);

    // Then
    expect(plans).toEqual([
      ["FREE", "free"],
      ["PREMIUM", "premium"],
      ["ADMIN", "premium"],
    ]);
  });

  it.each([
    {
      case: "구독 중인 USER",
      state: { role: "USER", subscriptionStatus: "ACTIVE", accessDeadline: null },
      expected: { tier: "PREMIUM", plan: "premium", isPremium: true },
    },
    {
      case: "구독을 취소한 USER",
      state: { role: "USER", subscriptionStatus: "CANCELLED", accessDeadline: null },
      expected: { tier: "FREE", plan: "free", isPremium: false },
    },
    {
      case: "구독 없는 ADMIN",
      state: { role: "ADMIN", subscriptionStatus: "FREE", accessDeadline: null },
      expected: { tier: "ADMIN", plan: "premium", isPremium: false },
    },
    {
      case: "구독 중인 ADMIN",
      state: { role: "ADMIN", subscriptionStatus: "ACTIVE", accessDeadline: AT.add({ hours: 1 }) },
      expected: { tier: "ADMIN", plan: "premium", isPremium: true },
    },
    {
      case: "구독이 지금 끝난 ADMIN",
      state: { role: "ADMIN", subscriptionStatus: "ACTIVE", accessDeadline: AT },
      expected: { tier: "ADMIN", plan: "premium", isPremium: false },
    },
    {
      case: "구독이 1ms 전에 끝난 ADMIN",
      state: {
        role: "ADMIN",
        subscriptionStatus: "ACTIVE",
        accessDeadline: AT.subtract({ milliseconds: 1 }),
      },
      expected: { tier: "ADMIN", plan: "premium", isPremium: false },
    },
    {
      case: "구독이 1ms 뒤에 끝나는 ADMIN",
      state: {
        role: "ADMIN",
        subscriptionStatus: "ACTIVE",
        accessDeadline: AT.add({ milliseconds: 1 }),
      },
      expected: { tier: "ADMIN", plan: "premium", isPremium: true },
    },
  ] as const)("$case는 $expected.tier·$expected.plan이다", ({ state, expected }) => {
    // When
    const subject = resolveAccessSubject({ state, now: AT });

    // Then
    expect(subject).toEqual(expected);
  });

  it("끝나는 시각이 지난 ACTIVE USER는 주체·요금제·isPremium이 함께 무료가 된다", () => {
    // Given
    const state = { role: "USER", subscriptionStatus: "ACTIVE", accessDeadline: AT } as const;

    // When
    const subject = resolveAccessSubject({ state, now: AT });

    // Then
    expect(subject).toEqual({ tier: "FREE", plan: "free", isPremium: false });
  });
});

describe("요금제별 기능", () => {
  it("모든 기능 값은 요금제 열 그대로이고 무제한 경로는 카탈로그의 null뿐이다", () => {
    // When
    const entitlements = PLANS.map((plan) =>
      resolveFeatureEntitlements({ plan, grants: NO_FEATURE_GRANTS }),
    );

    // Then
    expect(entitlements.map((features) => Object.keys(features))).toEqual([
      Object.keys(PLAN_CATALOG),
      Object.keys(PLAN_CATALOG),
    ]);
    expect(entitlements[0]?.AI_REPORT).toEqual({ allowed: false, limit: null });
    expect(entitlements[1]?.AI_REPORT).toEqual({ allowed: true, limit: null });
    expect(entitlements[0]?.VOICE_NOTE).toEqual({
      allowed: true,
      limit: PLAN_CATALOG.VOICE_NOTE.free,
    });
    expect(entitlements[1]?.TODO_CATEGORY).toEqual({
      allowed: true,
      limit: PLAN_CATALOG.TODO_CATEGORY.premium,
    });
  });

  it("프리미엄 AI 정리는 무제한으로 보이지만 서버는 공정 사용 상한으로 막는다", () => {
    // When
    const displayed = resolveFeatureEntitlement({
      plan: "premium",
      feature: "AI_PARSE",
      grants: NO_FEATURE_GRANTS,
    });
    const enforced = resolveQuotaLimit({ plan: "premium", feature: "AI_PARSE" });

    // Then
    expect(displayed.limit).toBeNull();
    expect(enforced).toEqual({ limit: PLAN_CATALOG.AI_PARSE.fairUse.premium, isFairUse: true });
  });

  it.each([
    {
      plan: "free",
      feature: "AI_PARSE",
      expected: { limit: PLAN_CATALOG.AI_PARSE.free, isFairUse: false },
    },
    {
      plan: "premium",
      feature: "VOICE_NOTE",
      expected: { limit: PLAN_CATALOG.VOICE_NOTE.fairUse.premium, isFairUse: true },
    },
    { plan: "premium", feature: "CHEER", expected: { limit: null, isFairUse: false } },
  ] as const)("$plan $feature 집행 한도는 $expected.limit이다", ({ plan, feature, expected }) => {
    // When
    const limit = resolveQuotaLimit({ plan, feature });

    // Then
    expect(limit).toEqual(expected);
  });

  it("무제한은 null을 유지하고 소진량이 한도를 넘으면 남은 횟수는 0이다", () => {
    // When
    const remaining = [calculateRemainingLimit(null, 100), calculateRemainingLimit(5, 6)];

    // Then
    expect(remaining).toEqual([null, 0]);
  });

  it.each([
    {
      plan: "free",
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
      plan: "premium",
      used: PLAN_CATALOG.VOICE_NOTE.fairUse.premium,
      expected: {
        limit: PLAN_CATALOG.VOICE_NOTE.fairUse.premium,
        remaining: 0,
        isFairUse: true,
        perUse: {
          maxSeconds: PLAN_CATALOG.VOICE_NOTE.perUse.maxSeconds.premium,
          maxCharacters: PLAN_CATALOG.VOICE_NOTE.perUse.maxCharacters.premium,
        },
      },
    },
  ] as const)(
    "$plan 녹음 정리 featureQuota는 집행 한도·남은 횟수·길이 상한을 서버가 계산한다",
    ({ plan, used, expected }) => {
      // Given
      const resetsAt = Temporal.Instant.from("2028-03-31T15:00:00.000Z");

      // When
      const quota = resolveFeatureQuota({
        plan,
        feature: "VOICE_NOTE",
        grants: NO_FEATURE_GRANTS,
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

  it("사용량을 세지 않는 resource·flag는 used·period·resetsAt이 null이고 받은 자리를 더한 한도를 쓴다", () => {
    // When
    const friend = resolveFeatureQuota({
      plan: "free",
      feature: "FRIEND",
      grants: { FRIEND: 2 },
      usage: null,
    });
    const report = resolveFeatureQuota({
      plan: "free",
      feature: "AI_REPORT",
      grants: NO_FEATURE_GRANTS,
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
      plan: "free",
      feature: "FRIEND",
      grants: { FRIEND: 1 },
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
    const perUse = resolvePerUseLimit({ plan: "premium", feature: "AI_PARSE" });

    // Then
    expect(perUse).toBeNull();
  });
});

describe("받은 자리(grant)", () => {
  it.each([
    { case: "무료 한도에 더한다", plan: "free", grant: 2, expected: PLAN_CATALOG.FRIEND.free + 2 },
    { case: "무제한 프리미엄 한도는 무제한으로 둔다", plan: "premium", grant: 2, expected: null },
    { case: "0은 더하지 않는다", plan: "free", grant: 0, expected: PLAN_CATALOG.FRIEND.free },
    {
      case: "음수는 한도를 줄이지 않는다",
      plan: "free",
      grant: -3,
      expected: PLAN_CATALOG.FRIEND.free,
    },
  ] as const)("친구 자리: $case", ({ plan, grant, expected }) => {
    // When
    const limit = resolveFeatureLimit({ plan, feature: "FRIEND", grants: { FRIEND: grant } });

    // Then
    expect(limit).toBe(expected);
  });

  it("받을 수 없는 기능은 같은 자리 값이 있어도 요금제 한도 그대로다", () => {
    // When
    const category = resolveFeatureLimit({
      plan: "free",
      feature: "TODO_CATEGORY",
      grants: { FRIEND: 5 },
    });

    // Then
    expect(category).toBe(PLAN_CATALOG.TODO_CATEGORY.free);
  });

  it("자리를 받았어도 무제한 요금제의 resource는 스냅샷에 개수를 싣지 않고, 무료는 싣는다", () => {
    // When
    const premium = resolveResourceUsage({
      plan: "premium",
      feature: "FRIEND",
      grants: { FRIEND: 3 },
      count: 12,
    });
    const free = resolveResourceUsage({
      plan: "free",
      feature: "FRIEND",
      grants: { FRIEND: 3 },
      count: 7,
    });

    // Then
    expect(premium).toBeNull();
    expect(free).toEqual({ used: 7, resetsAt: null });
  });
});
