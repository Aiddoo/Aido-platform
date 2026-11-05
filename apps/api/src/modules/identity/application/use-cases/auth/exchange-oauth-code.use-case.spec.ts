import { ErrorCode } from "@aido/api/errors";
import { vi } from "vitest";

import { AUTH_CREDENTIAL_TIME } from "#test/fixtures/auth-credential.fixture";
import { createAuthOAuthFixture } from "#test/fixtures/auth-oauth.fixture";
import { OAuthStateFixture } from "#test/fixtures/oauth-state.fixture";

import { ExchangeOAuthCode } from "./exchange-oauth-code.use-case.js";

describe("ExchangeOAuthCode — 일회용 로그인 결과 교환", () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(AUTH_CREDENTIAL_TIME);
  });
  afterEach(() => vi.useRealTimers());

  function given(overrides: Parameters<typeof OAuthStateFixture.create>[0] = {}) {
    const fixture = createAuthOAuthFixture();
    const state = OAuthStateFixture.create({
      exchangeCode: "exchange-secret",
      accessToken: "access-secret",
      refreshToken: "refresh-secret",
      userId: fixture.user.id,
      accountRestored: false,
      isNewUser: false,
      ...overrides,
    });
    fixture.oauthStateRepository.states.set(state.id, state);
    return { ...fixture, state, useCase: new ExchangeOAuthCode(fixture) };
  }

  it("로그인 결과를 반환하고 저장된 토큰을 지워 같은 코드를 재사용할 수 없게 한다", async () => {
    // Given
    const fixture = given();
    // When
    const result = await fixture.useCase.execute({ code: fixture.state.exchangeCode ?? "" });
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
    expect(fixture.oauthStateRepository.states.get(fixture.state.id)).toMatchObject({
      exchangedAt: AUTH_CREDENTIAL_TIME,
      accessToken: null,
      refreshToken: null,
    });
    await expect(fixture.useCase.execute({ code: "exchange-secret" })).rejects.toMatchObject({
      errorCode: ErrorCode.USER_0602,
    });
    expect(JSON.stringify(fixture.logger.debug.mock.calls)).not.toContain("secret");
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
    expect(fixture.oauthStateRepository.states.get(fixture.state.id)?.exchangedAt).toEqual(
      AUTH_CREDENTIAL_TIME,
    );
  });

  it.each([
    { description: "만료 경계", overrides: { expiresAt: AUTH_CREDENTIAL_TIME } },
    { description: "이미 교환", overrides: { exchangedAt: AUTH_CREDENTIAL_TIME } },
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
    expect(fixture.oauthStateRepository.states.get(fixture.state.id)?.exchangedAt).toEqual(
      fixture.state.exchangedAt,
    );
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
      userName: fixture.state.userName,
      profileImage: fixture.state.profileImage,
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
      const registeredAt = new Date("2026-11-05T00:00:00.000Z");
      const fixture = given({ isNewUser: true, provider: "KAKAO" });
      fixture.userRepository.users.set(fixture.user.id, {
        ...fixture.user,
        createdAt: registeredAt,
      });
      fixture.userRepository.profiles.set(fixture.user.id, {
        name: "새 사용자",
        profileImage: null,
      });
      // When
      const result = await fixture.useCase.execute({
        code: fixture.state.exchangeCode ?? "",
        device,
      });
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
      await fixture.useCase.execute({ code: fixture.state.exchangeCode ?? "", device });
      // Then
      expect(fixture.adminEventNotifier.notifications).toEqual([]);
    });

    it("같은 코드를 동시에 교환해도 알림은 성공한 한 번만 나간다", async () => {
      // Given
      const fixture = given({ isNewUser: true });
      const code = fixture.state.exchangeCode ?? "";
      // When
      const results = await Promise.allSettled([
        fixture.useCase.execute({ code, device }),
        fixture.useCase.execute({ code, device }),
      ]);
      // Then
      expect(results.filter(({ status }) => status === "fulfilled")).toHaveLength(1);
      expect(fixture.adminEventNotifier.notifications).toHaveLength(1);
    });

    it("가입 사용자 조회가 실패해도 토큰을 돌려주고 실패를 기록한다", async () => {
      // Given
      const fixture = given({ isNewUser: true });
      vi.spyOn(fixture.userRepository, "findByIdWithProfile").mockRejectedValue(
        new Error("database unavailable"),
      );
      // When
      const result = await fixture.useCase.execute({
        code: fixture.state.exchangeCode ?? "",
        device,
      });
      // Then
      expect(result.accessToken).toBe("access-secret");
      expect(fixture.adminEventNotifier.notifications).toEqual([]);
      expect(fixture.logger.error).toHaveBeenCalledTimes(1);
    });
  });
});
