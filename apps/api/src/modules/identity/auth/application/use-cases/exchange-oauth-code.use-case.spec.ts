import { ErrorCode } from "@aido/api/errors";

import { AuthLogEvent } from "#api/modules/identity/auth/application/auth.log-events";
import type { AuthOAuthStatePrimitives } from "#api/modules/identity/auth/domain/auth-oauth-state.aggregate";
import { InMemoryAuthOAuthStateRepository } from "#test/doubles/identity/in-memory-auth-oauth-state.repository";
import { InMemoryAuthUserRepository } from "#test/doubles/identity/in-memory-auth-user.repository";
import { AUTH_CREDENTIAL_NOW } from "#test/fixtures/auth-credential.fixture";
import { createAuthOAuthFixture } from "#test/fixtures/auth-oauth.fixture";
import { createAuthOAuthStateFixture } from "#test/fixtures/identity/auth-credential.fixture";
import { createIdentityUserFixture } from "#test/fixtures/identity/auth-session.fixture";

import { ExchangeOAuthCodeUseCase } from "./exchange-oauth-code.use-case.js";
import { NotifyOAuthSignupUseCase } from "./notify-oauth-signup.use-case.js";

describe("ExchangeOAuthCode — 일회용 로그인 결과 교환", () => {
  function given(overrides: Partial<AuthOAuthStatePrimitives> = {}) {
    const fixture = createAuthOAuthFixture();
    const state = createAuthOAuthStateFixture({
      exchangeCode: "exchange-secret",
      accessToken: "access-secret",
      refreshToken: "refresh-secret",
      userId: fixture.user.id,
      accountRestored: false,
      isNewUser: false,
      ...overrides,
    });
    const oauthStateRepository = new InMemoryAuthOAuthStateRepository([state]);
    return {
      ...fixture,
      oauthStateRepository,
      state,
      storedState: () => oauthStateRepository.all.find(({ id }) => id === state.id.value),
      useCase: new ExchangeOAuthCodeUseCase({ ...fixture, oauthStateRepository }),
    };
  }

  it("로그인 결과를 반환하고 저장된 토큰을 지워 같은 코드를 재사용할 수 없게 한다", async () => {
    // Given
    const fixture = given();
    // When
    const result = await fixture.useCase.execute({ code: "exchange-secret" });
    // Then
    expect(result).toStrictEqual({
      accessToken: "access-secret",
      refreshToken: "refresh-secret",
      userId: fixture.user.id,
      userName: undefined,
      profileImage: undefined,
      accountRestored: false,
      isNewUser: false,
    });
    expect(fixture.storedState()).toEqual({
      ...fixture.state.toPrimitives(),
      exchangedAt: AUTH_CREDENTIAL_NOW,
      accessToken: null,
      refreshToken: null,
    });
    await expect(fixture.useCase.execute({ code: "exchange-secret" })).rejects.toMatchObject({
      errorCode: ErrorCode.USER_0602,
    });
    expect(JSON.stringify(fixture.logger.messages)).not.toContain("secret");
  });

  it("동시에 읽은 같은 코드도 성공 응답은 한 번만 반환한다", async () => {
    // Given
    const fixture = given();
    // When
    const results = await Promise.allSettled([
      fixture.useCase.execute({ code: "exchange-secret" }),
      fixture.useCase.execute({ code: "exchange-secret" }),
    ]);
    // Then
    expect(results.filter((result) => result.status === "fulfilled")).toHaveLength(1);
    expect(results.filter((result) => result.status === "rejected")).toMatchObject([
      { reason: { errorCode: ErrorCode.USER_0602 } },
    ]);
    expect(fixture.storedState()?.exchangedAt).toEqual(AUTH_CREDENTIAL_NOW);
  });

  it.each([
    { description: "만료 경계", overrides: { expiresAt: AUTH_CREDENTIAL_NOW } },
    { description: "이미 교환", overrides: { exchangedAt: AUTH_CREDENTIAL_NOW } },
    { description: "accessToken 없음", overrides: { accessToken: null } },
    { description: "refreshToken 비어 있음", overrides: { refreshToken: "" } },
    { description: "userId 비어 있음", overrides: { userId: "" } },
  ])("$description: 토큰 응답 없이 거부하고 미소비 상태를 유지한다", async ({ overrides }) => {
    // Given
    const fixture = given(overrides);
    // When
    const pending = fixture.useCase.execute({ code: "exchange-secret" });
    // Then
    await expect(pending).rejects.toMatchObject({ errorCode: ErrorCode.USER_0602 });
    expect(fixture.storedState()).toEqual(fixture.state.toPrimitives());
  });

  it("이름·이미지·복구 정보를 포함하는 기존 결과를 그대로 반환한다", async () => {
    // Given
    const fixture = given({
      userName: "복구한 사용자",
      profileImage: "https://example.com/avatar.png",
      accountRestored: true,
    });
    // When
    const result = await fixture.useCase.execute({ code: "exchange-secret" });
    // Then
    expect(result).toMatchObject({
      userName: "복구한 사용자",
      profileImage: "https://example.com/avatar.png",
      accountRestored: true,
      isNewUser: false,
    });
  });

  it("저장된 신규 가입 여부를 그대로 반환한다", async () => {
    // Given
    const fixture = given({ isNewUser: true });
    // When
    const result = await fixture.useCase.execute({ code: "exchange-secret" });
    // Then
    expect(result.isNewUser).toBe(true);
  });

  it("신규 가입 여부가 없는 배포 전 교환 코드는 기존 로그인으로 본다", async () => {
    // Given
    const fixture = given({ isNewUser: null });
    // When
    const result = await fixture.useCase.execute({ code: "exchange-secret" });
    // Then
    expect(result.isNewUser).toBe(false);
  });

  describe("새 가입 알림", () => {
    const device = { devicePlatform: "IOS", appVersion: "1.14.2", timezone: "Asia/Seoul" } as const;

    it("웹 흐름의 새 가입이면 앱 요청의 기기 정보와 실제 가입 시각으로 알림을 한 번 보낸다", async () => {
      // Given
      const fixture = given({ isNewUser: true, provider: "KAKAO" });
      const userRepository = new InMemoryAuthUserRepository(
        [
          createIdentityUserFixture({
            ...fixture.user,
            createdAt: Temporal.Instant.from("2026-11-05T00:00:00Z"),
          }),
        ],
        { profiles: new Map([[fixture.user.id, { name: "새 사용자", profileImage: null }]]) },
      );
      const useCase = new ExchangeOAuthCodeUseCase({
        ...fixture,
        oauthSignupNotifier: new NotifyOAuthSignupUseCase({ ...fixture, userRepository }),
      });
      // When
      const result = await useCase.execute({ code: "exchange-secret", device });
      // Then
      expect(result.isNewUser).toBe(true);
      expect(fixture.adminEventNotifier.notifications).toEqual([
        {
          userId: fixture.user.id,
          email: fixture.user.email,
          provider: "kakao",
          registeredAt: "2026-11-05T00:00:00.000Z",
          name: "새 사용자",
          ...device,
        },
      ]);
    });

    it("기존 사용자 로그인 코드를 교환하면 알림을 보내지 않는다", async () => {
      // Given
      const fixture = given({ isNewUser: false });
      // When
      await fixture.useCase.execute({ code: "exchange-secret", device });
      // Then
      expect(fixture.adminEventNotifier.notifications).toEqual([]);
    });

    it("같은 코드를 동시에 교환해도 알림은 성공한 한 번만 나간다", async () => {
      // Given
      const fixture = given({ isNewUser: true });
      // When
      const results = await Promise.allSettled([
        fixture.useCase.execute({ code: "exchange-secret", device }),
        fixture.useCase.execute({ code: "exchange-secret", device }),
      ]);
      // Then
      expect(results.filter(({ status }) => status === "fulfilled")).toHaveLength(1);
      expect(fixture.adminEventNotifier.notifications).toHaveLength(1);
    });

    it("가입 사용자 조회가 실패해도 토큰을 돌려주고 실패를 기록한다", async () => {
      // Given
      const fixture = given({ isNewUser: true });
      const useCase = new ExchangeOAuthCodeUseCase({
        ...fixture,
        oauthSignupNotifier: new NotifyOAuthSignupUseCase({
          ...fixture,
          userRepository: {
            findByIdWithProfile: async () => {
              throw new Error("database unavailable");
            },
          },
        }),
      });
      // When
      const result = await useCase.execute({ code: "exchange-secret", device });
      // Then
      expect(result.accessToken).toBe("access-secret");
      expect(fixture.adminEventNotifier.notifications).toEqual([]);
      expect(
        fixture.logger.messages.filter(
          (message) =>
            typeof message !== "string" &&
            message.event === AuthLogEvent.SIGNUP_NOTIFICATION_FAILED,
        ),
      ).toHaveLength(1);
    });
  });
});
