import {
  AI_PARSE_LIMITS,
  CHEER_LIMITS,
  FOLLOW_LIMITS,
  NUDGE_LIMITS,
  TODO_CATEGORY_LIMITS,
} from "@aido/api/vocabulary";

import { createEntitlementFixture } from "#test/fixtures/entitlement.fixture";

import {
  Feature,
  Resource,
} from "../../../domain/policies/entitlement/entitlement-limits.policy.js";

describe("EntitlementService", () => {
  it.each([{ feature: Feature.CHEER }, { feature: Feature.NUDGE }, { feature: Feature.AI_PARSE }])(
    "ADMIN의 $feature 기능은 무료 구독에서도 무제한이다",
    async ({ feature }) => {
      // Given
      const fixture = createEntitlementFixture({ role: "ADMIN" });
      // When
      const entitlement = await fixture.service.getFeatureLimit(fixture.userId, feature);
      // Then
      expect(entitlement).toEqual({ dailyLimit: null, isAdmin: true, subscriptionStatus: "FREE" });
    },
  );

  it.each([{ feature: Feature.CHEER }, { feature: Feature.NUDGE }, { feature: Feature.AI_PARSE }])(
    "ACTIVE 사용자의 $feature 기능은 무제한이다",
    async ({ feature }) => {
      // Given
      const fixture = createEntitlementFixture({ subscriptionStatus: "ACTIVE" });
      // When
      const entitlement = await fixture.service.getFeatureLimit(fixture.userId, feature);
      // Then
      expect(entitlement).toEqual({
        dailyLimit: null,
        isAdmin: false,
        subscriptionStatus: "ACTIVE",
      });
    },
  );

  it.each([
    { status: "FREE", feature: Feature.CHEER, limit: CHEER_LIMITS.FREE_DAILY_LIMIT },
    { status: "FREE", feature: Feature.NUDGE, limit: NUDGE_LIMITS.FREE_DAILY_LIMIT },
    { status: "FREE", feature: Feature.AI_PARSE, limit: AI_PARSE_LIMITS.FREE_MONTHLY_LIMIT },
    { status: "EXPIRED", feature: Feature.CHEER, limit: CHEER_LIMITS.FREE_DAILY_LIMIT },
    { status: "EXPIRED", feature: Feature.NUDGE, limit: NUDGE_LIMITS.FREE_DAILY_LIMIT },
    { status: "EXPIRED", feature: Feature.AI_PARSE, limit: AI_PARSE_LIMITS.FREE_MONTHLY_LIMIT },
    { status: "CANCELLED", feature: Feature.CHEER, limit: CHEER_LIMITS.FREE_DAILY_LIMIT },
    { status: "CANCELLED", feature: Feature.NUDGE, limit: NUDGE_LIMITS.FREE_DAILY_LIMIT },
    { status: "CANCELLED", feature: Feature.AI_PARSE, limit: AI_PARSE_LIMITS.FREE_MONTHLY_LIMIT },
  ])(
    "$status 구독의 $feature 기능은 정의된 기간 한도 $limit 를 적용한다",
    async ({ status, feature, limit }) => {
      // Given
      const fixture = createEntitlementFixture({ subscriptionStatus: status });
      // When
      const entitlement = await fixture.service.getFeatureLimit(fixture.userId, feature);
      // Then
      expect(entitlement).toEqual({
        dailyLimit: limit,
        isAdmin: false,
        subscriptionStatus: status,
      });
    },
  );

  it.each([{ resource: Resource.FRIEND }, { resource: Resource.CATEGORY }])(
    "ADMIN의 $resource 보유량은 무제한이다",
    async ({ resource }) => {
      // Given
      const fixture = createEntitlementFixture({ role: "ADMIN" });
      // When
      const entitlement = await fixture.service.getResourceLimit(fixture.userId, resource);
      // Then
      expect(entitlement).toEqual({ maxCount: null, isAdmin: true, subscriptionStatus: "FREE" });
    },
  );

  it.each([
    { status: "ACTIVE", resource: Resource.FRIEND, limit: null },
    { status: "ACTIVE", resource: Resource.CATEGORY, limit: TODO_CATEGORY_LIMITS.ACTIVE_MAX_COUNT },
    { status: "FREE", resource: Resource.FRIEND, limit: FOLLOW_LIMITS.FREE_MAX_FRIENDS },
    { status: "FREE", resource: Resource.CATEGORY, limit: TODO_CATEGORY_LIMITS.FREE_MAX_COUNT },
    { status: "CANCELLED", resource: Resource.FRIEND, limit: FOLLOW_LIMITS.FREE_MAX_FRIENDS },
  ])(
    "$status 사용자의 $resource 보유량은 한도 $limit 를 적용한다",
    async ({ status, resource, limit }) => {
      // Given
      const fixture = createEntitlementFixture({ subscriptionStatus: status });
      // When
      const entitlement = await fixture.service.getResourceLimit(fixture.userId, resource);
      // Then
      expect(entitlement).toEqual({ maxCount: limit, isAdmin: false, subscriptionStatus: status });
    },
  );

  it("읽기 캐시는 저장 상태가 없어져도 warm snapshot을 반환하고 무효화 후 다시 조회한다", async () => {
    // Given
    const fixture = createEntitlementFixture({ subscriptionStatus: "ACTIVE" });
    await fixture.service.getFeatureLimit(fixture.userId, Feature.AI_PARSE);
    fixture.database.users.delete(fixture.userId);
    // When
    expect(await fixture.service.getFeatureLimit(fixture.userId, Feature.AI_PARSE)).toMatchObject({
      dailyLimit: null,
      subscriptionStatus: "ACTIVE",
    });
    await fixture.cache.invalidateSubscription(fixture.userId);
    // Then
    expect(await fixture.service.getFeatureLimit(fixture.userId, Feature.AI_PARSE)).toEqual({
      dailyLimit: AI_PARSE_LIMITS.FREE_MONTHLY_LIMIT,
      isAdmin: false,
      subscriptionStatus: "FREE",
    });
  });

  it.each([
    { status: "FREE", expected: AI_PARSE_LIMITS.FREE_MONTHLY_LIMIT },
    { status: "ACTIVE", expected: null },
  ])(
    "쓰기 판정은 warm cache와 달라진 최신 $status 상태를 사용한다",
    async ({ status, expected }) => {
      // Given
      const fixture = createEntitlementFixture({
        subscriptionStatus: status === "FREE" ? "ACTIVE" : "FREE",
      });
      await fixture.service.getFeatureLimit(fixture.userId, Feature.AI_PARSE);
      fixture.database.users.set(fixture.userId, { role: "USER", subscriptionStatus: status });
      // When
      const entitlement = await fixture.service.getFeatureLimitInTx(
        fixture.userId,
        Feature.AI_PARSE,
      );
      // Then
      expect(entitlement).toEqual({
        dailyLimit: expected,
        isAdmin: false,
        subscriptionStatus: status,
      });
    },
  );

  it("카테고리 쓰기 한도는 유료 cache가 남아 있어도 최신 무료 상태를 사용한다", async () => {
    // Given
    const fixture = createEntitlementFixture({ subscriptionStatus: "ACTIVE" });
    await fixture.service.getResourceLimit(fixture.userId, Resource.CATEGORY);
    fixture.database.users.set(fixture.userId, { role: "USER", subscriptionStatus: "FREE" });
    // When
    const entitlement = await fixture.service.getResourceLimitInTx(
      fixture.userId,
      Resource.CATEGORY,
    );
    // Then
    expect(entitlement).toEqual({
      maxCount: TODO_CATEGORY_LIMITS.FREE_MAX_COUNT,
      isAdmin: false,
      subscriptionStatus: "FREE",
    });
  });

  it("존재하지 않는 사용자는 읽기와 쓰기 모두 무료 기본 한도를 적용한다", async () => {
    // Given
    const fixture = createEntitlementFixture({ exists: false });
    // When
    const cached = await fixture.service.getFeatureLimit(fixture.userId, Feature.CHEER);
    const fresh = await fixture.service.getFeatureLimitInTx(fixture.userId, Feature.CHEER);
    // Then
    expect(cached).toEqual({
      dailyLimit: CHEER_LIMITS.FREE_DAILY_LIMIT,
      isAdmin: false,
      subscriptionStatus: "FREE",
    });
    expect(fresh).toEqual(cached);
  });

  it("알 수 없는 구독 상태는 무료 기본 한도로 안전하게 판정한다", async () => {
    // Given
    const fixture = createEntitlementFixture({ subscriptionStatus: "UNRECOGNIZED" });
    // When
    const feature = await fixture.service.getFeatureLimit(fixture.userId, Feature.AI_PARSE);
    const resource = await fixture.service.getResourceLimit(fixture.userId, Resource.CATEGORY);
    // Then
    expect(feature.dailyLimit).toBe(AI_PARSE_LIMITS.FREE_MONTHLY_LIMIT);
    expect(resource.maxCount).toBe(TODO_CATEGORY_LIMITS.FREE_MAX_COUNT);
    expect(await fixture.service.hasPremiumAccess(fixture.userId)).toBe(false);
  });

  it.each([
    { role: "ADMIN", status: "FREE", allowed: true },
    { role: "USER", status: "ACTIVE", allowed: true },
    { role: "USER", status: "FREE", allowed: false },
    { role: "USER", status: "EXPIRED", allowed: false },
    { role: "USER", status: "CANCELLED", allowed: false },
  ])("$role / $status 사용자의 premium 접근은 $allowed 이다", async ({ role, status, allowed }) => {
    // Given
    const fixture = createEntitlementFixture({ role, subscriptionStatus: status });
    // When
    const result = await fixture.service.hasPremiumAccess(fixture.userId);
    // Then
    expect(result).toBe(allowed);
  });

  it.each([
    { limit: null, used: 1_000, expected: null },
    { limit: 5, used: 7, expected: 0 },
    { limit: 5, used: 2, expected: 3 },
  ])("한도 $limit 와 사용량 $used 의 남은 횟수는 $expected 이다", ({ limit, used, expected }) => {
    // Given
    const fixture = createEntitlementFixture();
    // When
    const remaining = fixture.service.calculateRemaining(limit, used);
    // Then
    expect(remaining).toBe(expected);
  });
});
