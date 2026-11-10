import { PLAN_CATALOG } from "@aido/api/vocabulary";

import { UserId } from "#api/shared/domain/identifiers/user-id.vo";
import { FixedClock } from "#test/doubles/platform/fixed-clock";
import { createAccessUserFixture } from "#test/fixtures/access/access-user.fixture";
import { createEntitlementFixture } from "#test/fixtures/access/entitlement.fixture";

import { NO_FEATURE_GRANTS } from "../../domain/entitlements.constants.js";

describe("EntitlementReaderAdapter", () => {
  it.each(["CHEER", "NUDGE", "AI_PARSE", "FRIEND", "TODO_CATEGORY"] as const)(
    "구독 없는 ADMIN의 %s 표시 한도는 프리미엄 한도와 같다",
    async (feature) => {
      // Given
      const fixture = createEntitlementFixture({ role: "ADMIN" });
      // When
      const limit = await fixture.reader.getFeatureLimit(fixture.userId, feature);
      // Then
      expect(limit).toBe(PLAN_CATALOG[feature].premium);
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
    const result = await fixture.reader.getFeatureLimit(fixture.userId, feature);
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
    const limit = await fixture.reader.getFeatureLimit(fixture.userId, feature);
    // Then
    expect(limit).toBe(PLAN_CATALOG[feature].free);
  });

  it("읽기 캐시는 저장 상태가 없어져도 warm snapshot을 반환하고 무효화 후 다시 조회한다", async () => {
    // Given
    const fixture = createEntitlementFixture({ subscriptionStatus: "ACTIVE" });
    await fixture.reader.getFeatureLimit(fixture.userId, "AI_PARSE");
    fixture.users.delete(fixture.userId);
    // When
    const warm = await fixture.reader.getFeatureLimit(fixture.userId, "AI_PARSE");
    fixture.cache.entries.delete(fixture.userId);
    const cold = await fixture.reader.getFeatureLimit(fixture.userId, "AI_PARSE");
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
      await fixture.reader.getFeatureLimit(fixture.userId, "AI_PARSE");
      fixture.users.set(
        fixture.userId,
        createAccessUserFixture({ role: "USER", subscriptionStatus: status }),
      );
      // When
      const limit = await fixture.reader.getFeatureLimitInTx(fixture.userId, "AI_PARSE");
      // Then
      expect(limit).toBe(expected);
    },
  );

  it("카테고리 쓰기 한도는 유료 cache가 남아 있어도 최신 무료 상태를 사용한다", async () => {
    // Given
    const fixture = createEntitlementFixture({ subscriptionStatus: "ACTIVE" });
    await fixture.reader.getFeatureLimit(fixture.userId, "TODO_CATEGORY");
    fixture.users.set(
      fixture.userId,
      createAccessUserFixture({ role: "USER", subscriptionStatus: "FREE" }),
    );
    // When
    const limit = await fixture.reader.getFeatureLimitInTx(fixture.userId, "TODO_CATEGORY");
    // Then
    expect(limit).toBe(PLAN_CATALOG.TODO_CATEGORY.free);
  });

  it("존재하지 않는 사용자는 읽기와 쓰기 모두 무료 기본 한도를 적용한다", async () => {
    // Given
    const fixture = createEntitlementFixture({ exists: false });
    // When
    const cached = await fixture.reader.getFeatureLimit(fixture.userId, "CHEER");
    const fresh = await fixture.reader.getFeatureLimitInTx(fixture.userId, "CHEER");
    // Then
    expect([cached, fresh]).toEqual([PLAN_CATALOG.CHEER.free, PLAN_CATALOG.CHEER.free]);
  });

  it("캐시에 남은 알 수 없는 구독 상태는 무료 기본 한도로 안전하게 판정한다", async () => {
    // Given
    const fixture = createEntitlementFixture();
    fixture.cache.entries.set(fixture.userId, {
      status: "UNRECOGNIZED",
      isAdmin: false,
      accessDeadlineMs: null,
      resourceBonuses: NO_FEATURE_GRANTS,
    });
    // When
    const aiParse = await fixture.reader.getFeatureLimit(fixture.userId, "AI_PARSE");
    const category = await fixture.reader.getFeatureLimit(fixture.userId, "TODO_CATEGORY");
    // Then
    expect([aiParse, category]).toEqual([
      PLAN_CATALOG.AI_PARSE.free,
      PLAN_CATALOG.TODO_CATEGORY.free,
    ]);
    expect(await fixture.reader.can(fixture.userId, "AI_REPORT")).toBe(false);
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
    const result = await fixture.reader.can(fixture.userId, "AI_REPORT");
    // Then
    expect(result).toBe(allowed);
  });

  it.each(["FREE", "EXPIRED", "CANCELLED"])(
    "fresh premium은 warm ACTIVE cache와 달라진 %s 상태를 읽는다",
    async (status) => {
      const fixture = createEntitlementFixture({ subscriptionStatus: "ACTIVE" });
      expect(await fixture.reader.can(fixture.userId, "AI_REPORT")).toBe(true);
      fixture.users.set(
        fixture.userId,
        createAccessUserFixture({ role: "USER", subscriptionStatus: status }),
      );
      expect(await fixture.reader.canInTx(fixture.userId, "AI_REPORT")).toBe(false);
      expect(await fixture.reader.can(fixture.userId, "AI_REPORT")).toBe(true);
    },
  );
  it("fresh premium은 존재하지 않는 사용자와 ADMIN 삭제를 허용하지 않는다", async () => {
    const fixture = createEntitlementFixture({ role: "ADMIN" });
    expect(await fixture.reader.canInTx(fixture.userId, "AI_REPORT")).toBe(true);
    fixture.users.delete(fixture.userId);
    expect(await fixture.reader.canInTx(fixture.userId, "AI_REPORT")).toBe(false);
  });

  describe("역할이 바뀐 사용자의 권한 캐시", () => {
    const { free: FREE_CATEGORIES, premium: PREMIUM_CATEGORIES } = PLAN_CATALOG.TODO_CATEGORY;

    it.each([
      {
        from: "USER",
        to: "ADMIN",
        before: FREE_CATEGORIES,
        after: PREMIUM_CATEGORIES,
        subject: { tier: "ADMIN", plan: "premium" },
      },
      {
        from: "ADMIN",
        to: "USER",
        before: PREMIUM_CATEGORIES,
        after: FREE_CATEGORIES,
        subject: { tier: "FREE", plan: "free" },
      },
    ] as const)(
      "$from→$to: 쓰기 판정은 바로 새 역할을, 읽기 캐시는 비운 뒤부터 새 역할을 쓴다",
      async ({ from, to, before, after, subject }) => {
        // Given
        const fixture = createEntitlementFixture({ role: from });
        const warm = await fixture.reader.getFeatureLimit(fixture.userId, "TODO_CATEGORY");
        fixture.users.set(fixture.userId, createAccessUserFixture({ role: to }));

        // When
        const fresh = await fixture.reader.getFeatureLimitInTx(fixture.userId, "TODO_CATEGORY");
        const stale = await fixture.reader.getFeatureLimit(fixture.userId, "TODO_CATEGORY");
        await fixture.cache.invalidate(UserId.reconstitute(fixture.userId));
        const invalidated = await fixture.reader.getEntitlements(fixture.userId);

        // Then
        expect([warm, fresh, stale]).toEqual([before, after, before]);
        expect(invalidated).toMatchObject(subject);
        expect(invalidated.features.TODO_CATEGORY.limit).toBe(after);
      },
    );
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
        const quota = await fixture.reader.getFeatureQuotaInTx(fixture.userId, feature, {
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
      fixture.accessStateReader.featureGrants.seed(fixture.userId, { FRIEND: 2 });
      const limit = PLAN_CATALOG.FRIEND.free + 2;

      // When
      const quota = await fixture.reader.getFeatureQuotaInTx(fixture.userId, "FRIEND", {
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
      { role: "ADMIN", status: "FREE", limit: PLAN_CATALOG.TODO_CATEGORY.premium },
    ])("$role·$status 카테고리 한도는 $limit이다", async ({ role, status, limit }) => {
      // Given
      const fixture = createEntitlementFixture({ role, subscriptionStatus: status });

      // When
      const quota = await fixture.reader.getFeatureQuotaInTx(fixture.userId, "TODO_CATEGORY", {
        used: 3,
        resetsAt: null,
      });

      // Then
      expect(quota).toMatchObject({ limit, used: 3 });
    });

    it("유료 캐시가 남아 있어도 최신 무료 상태로 계산한다", async () => {
      // Given
      const fixture = createEntitlementFixture({ subscriptionStatus: "ACTIVE" });
      await fixture.reader.getFeatureLimit(fixture.userId, "CHEER");
      fixture.users.set(
        fixture.userId,
        createAccessUserFixture({ role: "USER", subscriptionStatus: "FREE" }),
      );

      // When
      const quota = await fixture.reader.getFeatureQuotaInTx(fixture.userId, "CHEER", {
        used: PLAN_CATALOG.CHEER.free,
        resetsAt: RESETS_AT,
      });

      // Then
      expect(quota).toMatchObject({ limit: PLAN_CATALOG.CHEER.free, remaining: 0 });
    });
  });

  describe("보상 기간 종료 경계", () => {
    const ENDS_AT = Temporal.Instant.from("2028-03-04T00:00:00.000Z");

    it("캐시가 남아 있어도 끝나는 시각부터는 정리 작업 전이라도 프리미엄이 아니다", async () => {
      // Given
      const clock = new FixedClock(ENDS_AT.subtract({ milliseconds: 1 }));
      const fixture = createEntitlementFixture(
        { subscriptionStatus: "ACTIVE", accessDeadline: ENDS_AT },
        { clock },
      );
      const before = await fixture.reader.can(fixture.userId, "AI_REPORT");

      // When
      clock.advanceBy({ milliseconds: 1 });
      const cached = await fixture.reader.can(fixture.userId, "AI_REPORT");
      const fresh = await fixture.reader.canInTx(fixture.userId, "AI_REPORT");
      const limit = await fixture.reader.getFeatureLimit(fixture.userId, "AI_PARSE");

      // Then
      expect([before, cached, fresh]).toEqual([true, false, false]);
      expect(limit).toBe(PLAN_CATALOG.AI_PARSE.free);
    });

    it("기한이 없는 1.13.0 이전 캐시는 기존처럼 상태를 그대로 쓴다", async () => {
      // Given
      const fixture = createEntitlementFixture({ subscriptionStatus: "FREE" });
      fixture.cache.entries.set(fixture.userId, {
        status: "ACTIVE",
        isAdmin: false,
        resourceBonuses: NO_FEATURE_GRANTS,
      });

      // When
      const premium = await fixture.reader.can(fixture.userId, "AI_REPORT");

      // Then
      expect(premium).toBe(true);
    });
  });
});
