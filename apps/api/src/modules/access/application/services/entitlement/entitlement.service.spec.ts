import { PLAN_CATALOG } from "@aido/api/vocabulary";

import { createEntitlementFixture } from "#test/fixtures/entitlement.fixture";

import { NO_RESOURCE_BONUSES } from "../../../domain/policies/entitlement/entitlement.policy.js";

describe("EntitlementService", () => {
  it.each(["CHEER", "NUDGE", "AI_PARSE", "FRIEND", "TODO_CATEGORY"] as const)(
    "ADMIN의 %s 한도는 무료 구독에서도 무제한이다",
    async (feature) => {
      // Given
      const fixture = createEntitlementFixture({ role: "ADMIN" });
      // When
      const limit = await fixture.service.getLimit(fixture.userId, feature);
      // Then
      expect(limit).toBeNull();
    },
  );

  it.each([
    { feature: "CHEER" as const, limit: null },
    { feature: "NUDGE" as const, limit: null },
    { feature: "AI_PARSE" as const, limit: null },
    { feature: "FRIEND" as const, limit: null },
    { feature: "TODO_CATEGORY" as const, limit: PLAN_CATALOG.TODO_CATEGORY.premium },
  ])("ACTIVE 사용자의 $feature 표시 한도는 $limit이다", async ({ feature, limit }) => {
    // Given
    const fixture = createEntitlementFixture({ subscriptionStatus: "ACTIVE" });
    // When
    const result = await fixture.service.getLimit(fixture.userId, feature);
    // Then
    expect(result).toBe(limit);
  });

  it.each(
    ["FREE", "EXPIRED", "CANCELLED"].flatMap((status) =>
      (["CHEER", "NUDGE", "AI_PARSE", "FRIEND", "TODO_CATEGORY"] as const).map((feature) => ({
        status,
        feature,
      })),
    ),
  )("$status 구독의 $feature는 카탈로그 무료 한도를 적용한다", async ({ status, feature }) => {
    // Given
    const fixture = createEntitlementFixture({ subscriptionStatus: status });
    // When
    const limit = await fixture.service.getLimit(fixture.userId, feature);
    // Then
    expect(limit).toBe(PLAN_CATALOG[feature].free);
  });

  it("읽기 캐시는 저장 상태가 없어져도 warm snapshot을 반환하고 무효화 후 다시 조회한다", async () => {
    // Given
    const fixture = createEntitlementFixture({ subscriptionStatus: "ACTIVE" });
    await fixture.service.getLimit(fixture.userId, "AI_PARSE");
    fixture.database.users.delete(fixture.userId);
    // When
    const warm = await fixture.service.getLimit(fixture.userId, "AI_PARSE");
    await fixture.cache.invalidateSubscription(fixture.userId);
    const cold = await fixture.service.getLimit(fixture.userId, "AI_PARSE");
    // Then
    expect([warm, cold]).toEqual([null, PLAN_CATALOG.AI_PARSE.free]);
  });

  it.each([
    { status: "FREE", expected: PLAN_CATALOG.AI_PARSE.free },
    { status: "ACTIVE", expected: null },
  ])(
    "쓰기 판정은 warm cache와 달라진 최신 $status 상태를 사용한다",
    async ({ status, expected }) => {
      // Given
      const fixture = createEntitlementFixture({
        subscriptionStatus: status === "FREE" ? "ACTIVE" : "FREE",
      });
      await fixture.service.getLimit(fixture.userId, "AI_PARSE");
      fixture.database.users.set(fixture.userId, { role: "USER", subscriptionStatus: status });
      // When
      const limit = await fixture.service.getLimitInTx(fixture.userId, "AI_PARSE");
      // Then
      expect(limit).toBe(expected);
    },
  );

  it("카테고리 쓰기 한도는 유료 cache가 남아 있어도 최신 무료 상태를 사용한다", async () => {
    // Given
    const fixture = createEntitlementFixture({ subscriptionStatus: "ACTIVE" });
    await fixture.service.getLimit(fixture.userId, "TODO_CATEGORY");
    fixture.database.users.set(fixture.userId, { role: "USER", subscriptionStatus: "FREE" });
    // When
    const limit = await fixture.service.getLimitInTx(fixture.userId, "TODO_CATEGORY");
    // Then
    expect(limit).toBe(PLAN_CATALOG.TODO_CATEGORY.free);
  });

  it("존재하지 않는 사용자는 읽기와 쓰기 모두 무료 기본 한도를 적용한다", async () => {
    // Given
    const fixture = createEntitlementFixture({ exists: false });
    // When
    const cached = await fixture.service.getLimit(fixture.userId, "CHEER");
    const fresh = await fixture.service.getLimitInTx(fixture.userId, "CHEER");
    // Then
    expect([cached, fresh]).toEqual([PLAN_CATALOG.CHEER.free, PLAN_CATALOG.CHEER.free]);
  });

  it("알 수 없는 구독 상태는 무료 기본 한도로 안전하게 판정한다", async () => {
    // Given
    const fixture = createEntitlementFixture({ subscriptionStatus: "UNRECOGNIZED" });
    // When
    const aiParse = await fixture.service.getLimit(fixture.userId, "AI_PARSE");
    const category = await fixture.service.getLimit(fixture.userId, "TODO_CATEGORY");
    // Then
    expect([aiParse, category]).toEqual([
      PLAN_CATALOG.AI_PARSE.free,
      PLAN_CATALOG.TODO_CATEGORY.free,
    ]);
    expect(await fixture.service.can(fixture.userId, "AI_REPORT")).toBe(false);
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
    const result = await fixture.service.can(fixture.userId, "AI_REPORT");
    // Then
    expect(result).toBe(allowed);
  });

  it.each(["FREE", "EXPIRED", "CANCELLED"])(
    "fresh premium은 warm ACTIVE cache와 달라진 %s 상태를 읽는다",
    async (status) => {
      const fixture = createEntitlementFixture({ subscriptionStatus: "ACTIVE" });
      expect(await fixture.service.can(fixture.userId, "AI_REPORT")).toBe(true);
      fixture.database.users.set(fixture.userId, { role: "USER", subscriptionStatus: status });
      expect(await fixture.service.canInTx(fixture.userId, "AI_REPORT")).toBe(false);
      expect(await fixture.service.can(fixture.userId, "AI_REPORT")).toBe(true);
    },
  );
  it("fresh premium은 존재하지 않는 사용자와 ADMIN 삭제를 허용하지 않는다", async () => {
    const fixture = createEntitlementFixture({ role: "ADMIN" });
    expect(await fixture.service.canInTx(fixture.userId, "AI_REPORT")).toBe(true);
    fixture.database.users.delete(fixture.userId);
    expect(await fixture.service.canInTx(fixture.userId, "AI_REPORT")).toBe(false);
  });

  describe("한도 오류 featureQuota", () => {
    const RESETS_AT = new Date("2028-03-04T15:00:00.000Z");

    it.each(["CHEER", "NUDGE"] as const)(
      "무료 %s 일간 한도를 다 쓰면 남은 횟수 0과 다음 자정을 돌려준다",
      async (feature) => {
        // Given
        const fixture = createEntitlementFixture({ subscriptionStatus: "FREE" });
        const used = PLAN_CATALOG[feature].free;

        // When
        const quota = await fixture.service.featureQuotaInTx(fixture.userId, feature, {
          used,
          resetsAt: RESETS_AT,
        });

        // Then
        expect(quota).toEqual({
          feature,
          allowed: true,
          limit: used,
          used,
          remaining: 0,
          period: "day",
          resetsAt: RESETS_AT.toISOString(),
          isFairUse: false,
          perUse: null,
        });
      },
    );

    it("친구 한도는 초대 보상 자리를 더하고 resource라 resetsAt이 null이다", async () => {
      // Given
      const fixture = createEntitlementFixture({ subscriptionStatus: "FREE" });
      fixture.database.resourceBonuses.set(fixture.userId, { FRIEND: 2 });
      const limit = PLAN_CATALOG.FRIEND.free + 2;

      // When
      const quota = await fixture.service.featureQuotaInTx(fixture.userId, "FRIEND", {
        used: limit,
        resetsAt: null,
      });

      // Then
      expect(quota).toMatchObject({
        feature: "FRIEND",
        limit,
        used: limit,
        remaining: 0,
        period: null,
        resetsAt: null,
      });
    });

    it.each([
      { role: "USER", status: "FREE", limit: PLAN_CATALOG.TODO_CATEGORY.free },
      { role: "USER", status: "ACTIVE", limit: PLAN_CATALOG.TODO_CATEGORY.premium },
      { role: "ADMIN", status: "FREE", limit: null },
    ])("$role·$status 카테고리 한도는 $limit이다", async ({ role, status, limit }) => {
      // Given
      const fixture = createEntitlementFixture({ role, subscriptionStatus: status });

      // When
      const quota = await fixture.service.featureQuotaInTx(fixture.userId, "TODO_CATEGORY", {
        used: 3,
        resetsAt: null,
      });

      // Then
      expect(quota).toMatchObject({ limit, used: 3 });
    });

    it("유료 캐시가 남아 있어도 최신 무료 상태로 계산한다", async () => {
      // Given
      const fixture = createEntitlementFixture({ subscriptionStatus: "ACTIVE" });
      await fixture.service.getLimit(fixture.userId, "CHEER");
      fixture.database.users.set(fixture.userId, { role: "USER", subscriptionStatus: "FREE" });

      // When
      const quota = await fixture.service.featureQuotaInTx(fixture.userId, "CHEER", {
        used: PLAN_CATALOG.CHEER.free,
        resetsAt: RESETS_AT,
      });

      // Then
      expect(quota).toMatchObject({ limit: PLAN_CATALOG.CHEER.free, remaining: 0 });
    });
  });

  describe("보상 기간 종료 경계", () => {
    const ENDS_AT = new Date("2028-03-04T00:00:00.000Z");
    afterEach(() => vi.useRealTimers());

    it("캐시가 남아 있어도 끝나는 시각부터는 정리 작업 전이라도 프리미엄이 아니다", async () => {
      // Given
      vi.useFakeTimers({ toFake: ["Date"] });
      vi.setSystemTime(new Date("2028-03-03T23:59:59.999Z"));
      const fixture = createEntitlementFixture({
        subscriptionStatus: "ACTIVE",
        accessDeadline: ENDS_AT,
      });
      const before = await fixture.service.can(fixture.userId, "AI_REPORT");

      // When
      vi.setSystemTime(ENDS_AT);
      const cached = await fixture.service.can(fixture.userId, "AI_REPORT");
      const fresh = await fixture.service.canInTx(fixture.userId, "AI_REPORT");
      const limit = await fixture.service.getLimit(fixture.userId, "AI_PARSE");

      // Then
      expect([before, cached, fresh]).toEqual([true, false, false]);
      expect(limit).toBe(PLAN_CATALOG.AI_PARSE.free);
    });

    it("기한이 없는 1.13.0 이전 캐시는 기존처럼 상태를 그대로 쓴다", async () => {
      // Given
      const fixture = createEntitlementFixture({ subscriptionStatus: "FREE" });
      fixture.cache.snapshots.set(fixture.userId, {
        status: "ACTIVE",
        isAdmin: false,
        resourceBonuses: NO_RESOURCE_BONUSES,
      });

      // When
      const premium = await fixture.service.can(fixture.userId, "AI_REPORT");

      // Then
      expect(premium).toBe(true);
    });
  });
});
