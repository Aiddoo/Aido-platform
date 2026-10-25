import { ErrorCode } from "@aido/api/errors";
import { vi } from "vitest";

import {
  AUTH_CREDENTIAL_TIME,
  createAuthCredentialFixture,
} from "#test/fixtures/auth-credential.fixture";

import { GetCurrentUser } from "./get-current-user.use-case.js";

describe("GetCurrentUser — 현재 사용자 조회", () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(AUTH_CREDENTIAL_TIME);
  });
  afterEach(() => vi.useRealTimers());

  function given(options: Parameters<typeof createAuthCredentialFixture>[0] = {}) {
    const fixture = createAuthCredentialFixture(options);
    const useCase = new GetCurrentUser({
      userRepository: fixture.userRepository,
      cacheService: fixture.cacheService,
      premiumAccessReader: fixture.premiumAccessReader,
    });
    return { ...fixture, useCase };
  }

  it("nullable 프로필과 여러 provider를 보존하며 요청별 sessionId는 캐시하지 않는다", async () => {
    // Given
    const fixture = given({ pending: true });
    fixture.userRepository.profiles.set(fixture.user.id, { name: null, profileImage: null });
    fixture.userRepository.providers.set(fixture.user.id, [
      { provider: "CREDENTIAL" },
      { provider: "GOOGLE" },
    ]);
    // When
    const first = await fixture.useCase.execute({
      userId: fixture.user.id,
      sessionId: "session-1",
    });
    fixture.userRepository.users.delete(fixture.user.id);
    const second = await fixture.useCase.execute({
      userId: fixture.user.id,
      sessionId: "session-2",
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
    expect(fixture.userRepository.users.size).toBe(0);
  });

  it("없는 사용자는 USER_0601이며 보상·구독을 조회하지 않고 실패 결과를 프로필 캐시에 저장하지 않는다", async () => {
    // Given
    const fixture = given({ empty: true });
    // When
    const pending = fixture.useCase.execute({ userId: fixture.user.id, sessionId: "session-1" });
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
    });

    // When
    const result = await fixture.useCase.execute({
      userId: fixture.user.id,
      sessionId: "session-1",
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
    });

    // When
    const result = await fixture.useCase.execute({
      userId: fixture.user.id,
      sessionId: "session-1",
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
});
