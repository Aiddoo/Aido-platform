import { ErrorCode } from "@aido/api/errors";
import { PLAN_CATALOG, PREMIUM_FEATURE_KEYS } from "@aido/api/vocabulary";

import { UserId } from "#api/shared/domain/identifiers/user-id.vo";
import { createAuthCredentialFixture } from "#test/fixtures/auth-credential.fixture";

import { GetCurrentUserUseCase } from "./get-current-user.use-case.js";

describe("GetCurrentUser — 현재 사용자 조회", () => {
  function given(options: Parameters<typeof createAuthCredentialFixture>[0] = {}) {
    const fixture = createAuthCredentialFixture(options);
    const useCase = new GetCurrentUserUseCase({
      userRepository: fixture.userRepository,
      cacheService: fixture.cacheService,
      premiumAccessReader: fixture.premiumAccessReader,
      entitlementReader: fixture.entitlementReader,
      quotaLedger: fixture.quotaLedger,
      cheerUsageReader: fixture.cheerUsageReader,
      nudgeUsageReader: fixture.nudgeUsageReader,
    });
    return { ...fixture, useCase };
  }

  it("nullable 프로필과 여러 provider를 보존하며 요청별 sessionId는 캐시하지 않는다", async () => {
    // Given
    const fixture = given({ pending: true });
    await fixture.userRepository.createProfile(UserId.reconstitute(fixture.user.id), {});
    await fixture.accountRepository.createOAuthAccount({
      userId: UserId.reconstitute(fixture.user.id),
      provider: "GOOGLE",
      providerAccountId: "google-account",
    });

    // When
    const first = await fixture.useCase.execute({
      userId: fixture.user.id,
      sessionId: "session-1",
      timezone: "Asia/Seoul",
    });
    await fixture.userRepository.hardDelete(UserId.reconstitute(fixture.user.id));
    const second = await fixture.useCase.execute({
      userId: fixture.user.id,
      sessionId: "session-2",
      timezone: "Asia/Seoul",
    });

    // Then
    expect(first).toMatchObject({
      userId: fixture.user.id,
      email: fixture.user.email,
      emailVerifiedAt: null,
      name: null,
      profileImage: null,
      providers: ["CREDENTIAL", "GOOGLE"],
      sessionId: "session-1",
    });
    expect(second).toEqual({ ...first, sessionId: "session-2" });
    expect(fixture.userRepository.stored(fixture.user.id)).toBeUndefined();
  });

  it("없는 사용자는 USER_0601이며 보상·구독을 조회하지 않고 실패 결과를 프로필 캐시에 저장하지 않는다", async () => {
    // Given
    const fixture = given({ empty: true });

    // When
    const pending = fixture.useCase.execute({
      userId: fixture.user.id,
      sessionId: "session-1",
      timezone: "Asia/Seoul",
    });

    // Then
    await expect(pending).rejects.toMatchObject({
      errorCode: ErrorCode.USER_0601,
      details: { userId: fixture.user.id },
    });
    expect(fixture.cacheService.profiles.size).toBe(0);
    expect(fixture.premiumAccessReader.requestedUserIds).toEqual([]);
  });

  it("보상 기간만 있는 사용자는 출처 GRANT와 종료 시각, 자동 갱신 아님을 함께 반환한다", async () => {
    // Given
    const fixture = given();
    fixture.premiumAccessReader.accesses.set(fixture.user.id, {
      source: "GRANT",
      endsAt: new Date("2026-11-08T00:00:00.000Z"),
      periodEndsAt: new Date("2026-11-08T00:00:00.000Z"),
      willRenew: false,
      bankedDays: 0,
      recentGrantEndedAt: null,
      isTrial: false,
      planType: null,
    });

    // When
    const result = await fixture.useCase.execute({
      userId: fixture.user.id,
      sessionId: "session-1",
      timezone: "Asia/Seoul",
    });

    // Then
    expect(result).toMatchObject({
      premiumSource: "GRANT",
      premiumEndsAt: "2026-11-08T00:00:00.000Z",
      premiumPeriodEndsAt: "2026-11-08T00:00:00.000Z",
      willRenew: false,
      bankedPremiumDays: 0,
    });
  });

  it("스토어 구독 중 쌓인 보상이 있으면 대기 중인 일수를 함께 반환한다", async () => {
    // Given
    const fixture = given();
    fixture.premiumAccessReader.accesses.set(fixture.user.id, {
      source: "STORE",
      endsAt: new Date("2026-12-15T03:00:00.000Z"),
      periodEndsAt: new Date("2026-12-01T00:00:00.000Z"),
      willRenew: true,
      bankedDays: 14,
      recentGrantEndedAt: null,
      isTrial: false,
      planType: null,
    });

    // When
    const result = await fixture.useCase.execute({
      userId: fixture.user.id,
      sessionId: "session-1",
      timezone: "Asia/Seoul",
    });

    // Then
    expect(result).toMatchObject({
      premiumSource: "STORE",
      premiumEndsAt: "2026-12-15T03:00:00.000Z",
      premiumPeriodEndsAt: "2026-12-01T00:00:00.000Z",
      willRenew: true,
      bankedPremiumDays: 14,
    });
  });

  it("권한은 프로필 캐시와 별개로 매번 계산하고 횟수 기능에는 사용량과 초기화 시각을 붙인다", async () => {
    // Given
    const fixture = given();
    fixture.quotaLedger.used = 2;
    fixture.cheerUsageReader.used = 1;
    fixture.nudgeUsageReader.used = 3;
    const input = {
      userId: fixture.user.id,
      sessionId: "session-1",
      timezone: "America/Los_Angeles",
    };
    await fixture.useCase.execute(input);
    fixture.entitlementReader.tiers.set(fixture.user.id, "PREMIUM");
    fixture.entitlementReader.activeSubscriptionUserIds.add(fixture.user.id);

    // When
    const result = await fixture.useCase.execute(input);

    // Then
    expect(result.isPremium).toBe(true);
    expect(result.entitlements?.AI_PARSE).toEqual({
      allowed: true,
      limit: null,
      used: 2,
      resetsAt: "2026-11-30T15:00:00.000Z",
    });
    expect(result.entitlements?.NUDGE).toEqual({
      allowed: true,
      limit: null,
      used: 3,
      resetsAt: "2026-11-03T15:00:00.000Z",
    });
    expect(result.entitlements?.FRIEND).toEqual({ allowed: true, limit: null });
    expect(result.entitlements?.AI_REPORT).toEqual({ allowed: true, limit: null });
    expect(fixture.cheerUsageReader.timezones).toEqual([
      "America/Los_Angeles",
      "America/Los_Angeles",
    ]);
  });

  it("ADMIN은 isPremium이 아니어도 프리미엄과 같은 /me 권한을 받는다(카테고리 30개)", async () => {
    // Given
    const admin = given();
    admin.entitlementReader.tiers.set(admin.user.id, "ADMIN");
    const premium = given();
    premium.entitlementReader.tiers.set(premium.user.id, "PREMIUM");
    premium.entitlementReader.activeSubscriptionUserIds.add(premium.user.id);
    const input = { sessionId: "session-1", timezone: "Asia/Seoul" };

    // When
    const adminResult = await admin.useCase.execute({ ...input, userId: admin.user.id });
    const premiumResult = await premium.useCase.execute({ ...input, userId: premium.user.id });

    // Then
    expect(adminResult.isPremium).toBe(false);
    expect(Object.keys(adminResult.entitlements ?? {})).toEqual([...PREMIUM_FEATURE_KEYS]);
    expect(adminResult.entitlements).toEqual(premiumResult.entitlements);
    expect(adminResult.entitlements?.TODO_CATEGORY).toEqual({
      allowed: true,
      limit: PLAN_CATALOG.TODO_CATEGORY.premium,
    });
    expect(adminResult.entitlements?.AI_PARSE).toMatchObject({ allowed: true, limit: null });
  });
});
