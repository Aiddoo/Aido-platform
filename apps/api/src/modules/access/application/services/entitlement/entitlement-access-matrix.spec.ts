import { ErrorCode } from "@aido/api/errors";
import { PLAN_FEATURE_KEYS } from "@aido/api/vocabulary";

import { ApplicationException } from "#api/shared/domain/exceptions/application.exception";
import { createEntitlementFixture } from "#test/fixtures/entitlement.fixture";

import { assertEntitled, assertEntitledInTx } from "./entitlement-guard.js";

const NOW = new Date("2026-11-03T00:00:00.000Z");
const SECOND_MS = 1_000;

const SUBJECTS = {
  FREE: { role: "USER", subscriptionStatus: "FREE", accessDeadline: null },
  PREMIUM: {
    role: "USER",
    subscriptionStatus: "ACTIVE",
    accessDeadline: new Date(NOW.getTime() + SECOND_MS),
  },
  EXPIRED_ACTIVE: {
    role: "USER",
    subscriptionStatus: "ACTIVE",
    accessDeadline: new Date(NOW.getTime() - SECOND_MS),
  },
  ADMIN: { role: "ADMIN", subscriptionStatus: "FREE", accessDeadline: null },
} as const;

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(NOW);
});
afterEach(() => vi.useRealTimers());

describe("EntitlementService — 세 주체 × 기능 종류 권한 매트릭스", () => {
  it.each([
    { subject: "FREE", aiParse: 10, friend: 5, aiReport: false, isPremium: false },
    { subject: "PREMIUM", aiParse: null, friend: null, aiReport: true, isPremium: true },
    { subject: "EXPIRED_ACTIVE", aiParse: 10, friend: 5, aiReport: false, isPremium: false },
    { subject: "ADMIN", aiParse: null, friend: null, aiReport: true, isPremium: false },
  ] as const)(
    "$subject는 AI 파싱 한도 $aiParse·친구 한도 $friend·AI 리포트 $aiReport·isPremium $isPremium이다",
    async ({ subject, aiParse, friend, aiReport, isPremium }) => {
      // Given
      const fixture = createEntitlementFixture(SUBJECTS[subject]);

      // When
      const snapshot = await fixture.service.getAccessSnapshot(fixture.userId);
      const limits = {
        aiParse: await fixture.service.getLimit(fixture.userId, "AI_PARSE"),
        friend: await fixture.service.getLimitInTx(fixture.userId, "FRIEND"),
      };
      const canReport = {
        cached: await fixture.service.can(fixture.userId, "AI_REPORT"),
        fresh: await fixture.service.canInTx(fixture.userId, "AI_REPORT"),
      };

      // Then
      expect(limits).toEqual({ aiParse, friend });
      expect(canReport).toEqual({ cached: aiReport, fresh: aiReport });
      expect(snapshot.isPremium).toBe(isPremium);
      expect(snapshot.features.AI_PARSE).toEqual({ allowed: true, limit: aiParse });
      expect(snapshot.features.FRIEND).toEqual({ allowed: true, limit: friend });
      expect(snapshot.features.AI_REPORT).toEqual({ allowed: aiReport, limit: null });
    },
  );

  it("ADMIN은 카탈로그의 모든 기능을 한도 없이 쓸 수 있다", async () => {
    // Given
    const fixture = createEntitlementFixture(SUBJECTS.ADMIN);

    // When
    const { tier, features } = await fixture.service.getAccessSnapshot(fixture.userId);

    // Then
    expect(tier).toBe("ADMIN");
    expect(Object.keys(features)).toEqual([...PLAN_FEATURE_KEYS]);
    expect(Object.values(features).every((access) => access.allowed && access.limit == null)).toBe(
      true,
    );
  });

  it("프리미엄 카테고리는 무제한이 아니라 30개까지이고 친구 보너스 자리는 무료 한도에만 더한다", async () => {
    // Given
    const premium = createEntitlementFixture(SUBJECTS.PREMIUM);
    const free = createEntitlementFixture(SUBJECTS.FREE);
    free.database.resourceBonuses.set(free.userId, { FRIEND: 2 });

    // When
    const premiumCategory = await premium.service.getLimit(premium.userId, "TODO_CATEGORY");
    const freeFriend = await free.service.getLimit(free.userId, "FRIEND");

    // Then
    expect(premiumCategory).toBe(30);
    expect(freeFriend).toBe(7);
  });

  it.each([
    { label: "만료 1ms 전", offsetMs: 1, expected: true },
    { label: "만료 시각 정각", offsetMs: 0, expected: false },
    { label: "만료 1초 뒤", offsetMs: -SECOND_MS, expected: false },
  ])("$label에는 프리미엄 여부가 $expected다", async ({ offsetMs, expected }) => {
    // Given
    const fixture = createEntitlementFixture({
      subscriptionStatus: "ACTIVE",
      accessDeadline: new Date(NOW.getTime() + offsetMs),
    });

    // When
    const snapshot = await fixture.service.getAccessSnapshot(fixture.userId);

    // Then
    expect(snapshot.isPremium).toBe(expected);
    expect(snapshot.features.AI_SUGGESTION.allowed).toBe(expected);
  });
});

describe("assertEntitled — 기능별 기존 거부 코드", () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(NOW);
  });
  afterEach(() => vi.useRealTimers());

  it.each([
    { feature: "AI_REPORT", errorCode: ErrorCode.AI_1308 },
    { feature: "AI_SUGGESTION", errorCode: ErrorCode.AI_1309 },
    { feature: "CUSTOM_REMINDER_TIME", errorCode: ErrorCode.PREFERENCE_1701 },
  ] as const)("무료 사용자의 $feature는 $errorCode로 거부한다", async ({ feature, errorCode }) => {
    // Given
    const fixture = createEntitlementFixture(SUBJECTS.FREE);

    // When
    const cached = assertEntitled(fixture.service, fixture.userId, feature);
    const fresh = assertEntitledInTx(fixture.service, fixture.userId, feature);

    // Then
    await expect(cached).rejects.toEqual(new ApplicationException(errorCode));
    await expect(fresh).rejects.toMatchObject({ errorCode });
  });

  it("ADMIN과 프리미엄은 거부하지 않는다", async () => {
    // Given
    const admin = createEntitlementFixture(SUBJECTS.ADMIN);
    const premium = createEntitlementFixture(SUBJECTS.PREMIUM);

    // When / Then
    await expect(assertEntitled(admin.service, admin.userId, "AI_REPORT")).resolves.toBeUndefined();
    await expect(
      assertEntitledInTx(premium.service, premium.userId, "CUSTOM_REMINDER_TIME"),
    ).resolves.toBeUndefined();
  });
});
