import { ErrorCode } from "@aido/api/errors";
import { PLAN_CATALOG, PLAN_FEATURE_KEYS } from "@aido/api/vocabulary";

import { ApplicationException } from "#api/shared/application/application.exception";
import { FixedClock } from "#test/doubles/platform/fixed-clock";
import type { AccessUserInput } from "#test/fixtures/access/access-user.fixture";
import { createEntitlementFixture } from "#test/fixtures/access/entitlement.fixture";

import { assertEntitled } from "../../application/entitlements.errors.js";

const NOW = Temporal.Instant.from("2026-11-03T00:00:00.000Z");
const SECOND_MS = 1000;

const SUBJECTS = {
  FREE: { role: "USER", subscriptionStatus: "FREE", accessDeadline: null },
  PREMIUM: {
    role: "USER",
    subscriptionStatus: "ACTIVE",
    accessDeadline: NOW.add({ milliseconds: SECOND_MS }),
  },
  EXPIRED_ACTIVE: {
    role: "USER",
    subscriptionStatus: "ACTIVE",
    accessDeadline: NOW.subtract({ milliseconds: SECOND_MS }),
  },
  ADMIN: { role: "ADMIN", subscriptionStatus: "FREE", accessDeadline: null },
  ADMIN_SUBSCRIBED: {
    role: "ADMIN",
    subscriptionStatus: "ACTIVE",
    accessDeadline: NOW.add({ milliseconds: SECOND_MS }),
  },
  ADMIN_EXPIRED_NOW: { role: "ADMIN", subscriptionStatus: "ACTIVE", accessDeadline: NOW },
  ADMIN_EXPIRED_1MS_AGO: {
    role: "ADMIN",
    subscriptionStatus: "ACTIVE",
    accessDeadline: NOW.subtract({ milliseconds: 1 }),
  },
} as const;

function entitlementAt(input: AccessUserInput) {
  return createEntitlementFixture(input, { clock: new FixedClock(NOW) });
}

describe("EntitlementReaderAdapter — 세 주체 × 기능 종류 권한 매트릭스", () => {
  it.each([
    { subject: "FREE", aiParse: 10, friend: 5, aiReport: false, isPremium: false },
    { subject: "PREMIUM", aiParse: null, friend: null, aiReport: true, isPremium: true },
    { subject: "EXPIRED_ACTIVE", aiParse: 10, friend: 5, aiReport: false, isPremium: false },
    { subject: "ADMIN", aiParse: null, friend: null, aiReport: true, isPremium: false },
    { subject: "ADMIN_SUBSCRIBED", aiParse: null, friend: null, aiReport: true, isPremium: true },
    { subject: "ADMIN_EXPIRED_NOW", aiParse: null, friend: null, aiReport: true, isPremium: false },
    {
      subject: "ADMIN_EXPIRED_1MS_AGO",
      aiParse: null,
      friend: null,
      aiReport: true,
      isPremium: false,
    },
  ] as const)(
    "$subject는 AI 파싱 한도 $aiParse·친구 한도 $friend·AI 리포트 $aiReport·isPremium $isPremium이다",
    async ({ subject, aiParse, friend, aiReport, isPremium }) => {
      // Given
      const fixture = entitlementAt(SUBJECTS[subject]);

      // When
      const snapshot = await fixture.reader.getEntitlements(fixture.userId);
      const limits = {
        aiParse: await fixture.reader.getFeatureLimit(fixture.userId, "AI_PARSE"),
        friend: await fixture.reader.getFeatureLimitInTx(fixture.userId, "FRIEND"),
      };
      const canReport = {
        cached: await fixture.reader.can(fixture.userId, "AI_REPORT"),
        fresh: await fixture.reader.canInTx(fixture.userId, "AI_REPORT"),
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

  it.each(["ADMIN", "ADMIN_SUBSCRIBED", "ADMIN_EXPIRED_NOW", "ADMIN_EXPIRED_1MS_AGO"] as const)(
    "%s는 구독과 무관하게 프리미엄과 같은 기능·한도를 받고 주체는 ADMIN으로 남는다",
    async (subject) => {
      // Given
      const admin = entitlementAt(SUBJECTS[subject]);
      const premium = entitlementAt(SUBJECTS.PREMIUM);

      // When
      const adminEntitlements = await admin.reader.getEntitlements(admin.userId);
      const premiumEntitlements = await premium.reader.getEntitlements(premium.userId);
      const categoryLimit = await admin.reader.getFeatureLimitInTx(admin.userId, "TODO_CATEGORY");

      // Then
      expect(adminEntitlements).toMatchObject({ tier: "ADMIN", plan: "premium" });
      expect(Object.keys(adminEntitlements.features)).toEqual([...PLAN_FEATURE_KEYS]);
      expect(adminEntitlements.features).toEqual(premiumEntitlements.features);
      expect(categoryLimit).toBe(PLAN_CATALOG.TODO_CATEGORY.premium);
    },
  );

  it("프리미엄 카테고리는 무제한이 아니라 30개까지이고 친구 보너스 자리는 무료 한도에만 더한다", async () => {
    // Given
    const premium = entitlementAt(SUBJECTS.PREMIUM);
    const free = entitlementAt(SUBJECTS.FREE);
    free.accessStateReader.featureGrants.seed(free.userId.value, { FRIEND: 2 });

    // When
    const premiumCategory = await premium.reader.getFeatureLimit(premium.userId, "TODO_CATEGORY");
    const freeFriend = await free.reader.getFeatureLimit(free.userId, "FRIEND");

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
    const fixture = entitlementAt({
      subscriptionStatus: "ACTIVE",
      accessDeadline: NOW.add({ milliseconds: offsetMs }),
    });

    // When
    const snapshot = await fixture.reader.getEntitlements(fixture.userId);

    // Then
    expect(snapshot.isPremium).toBe(expected);
    expect(snapshot.features.AI_SUGGESTION.allowed).toBe(expected);
  });
});

describe("assertEntitled — 기능별 기존 거부 코드", () => {
  it.each([
    { feature: "AI_REPORT", errorCode: ErrorCode.AI_1308 },
    { feature: "AI_SUGGESTION", errorCode: ErrorCode.AI_1309 },
    { feature: "CUSTOM_REMINDER_TIME", errorCode: ErrorCode.PREFERENCE_1701 },
  ] as const)("무료 사용자의 $feature는 $errorCode로 거부한다", async ({ feature, errorCode }) => {
    // Given
    const fixture = entitlementAt(SUBJECTS.FREE);

    // When
    const denied = assertEntitled(fixture.reader, fixture.userId, feature);

    // Then
    await expect(denied).rejects.toEqual(new ApplicationException(errorCode));
  });

  it("ADMIN과 프리미엄은 거부하지 않는다", async () => {
    // Given
    const admin = entitlementAt(SUBJECTS.ADMIN);
    const premium = entitlementAt(SUBJECTS.PREMIUM);

    // When / Then
    await expect(assertEntitled(admin.reader, admin.userId, "AI_REPORT")).resolves.toBeUndefined();
    await expect(
      assertEntitled(premium.reader, premium.userId, "CUSTOM_REMINDER_TIME"),
    ).resolves.toBeUndefined();
  });
});
