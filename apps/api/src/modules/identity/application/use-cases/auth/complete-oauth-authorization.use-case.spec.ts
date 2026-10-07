import { ErrorCode } from "@aido/api/errors";
import { vi } from "vitest";

import { AUTH_CREDENTIAL_TIME } from "#test/fixtures/auth-credential.fixture";
import { createAuthOAuthFixture } from "#test/fixtures/auth-oauth.fixture";
import { OAuthStateFixture } from "#test/fixtures/oauth-state.fixture";

import { CompleteOAuthAuthorization } from "./complete-oauth-authorization.use-case.js";
import { LoginWithOAuthToken } from "./login-with-oauth-token.use-case.js";

describe("CompleteOAuthAuthorization — 코드 교환부터 실제 로그인까지", () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(AUTH_CREDENTIAL_TIME);
  });
  afterEach(() => vi.useRealTimers());

  function given(
    provider: Parameters<CompleteOAuthAuthorization["execute"]>[0]["provider"] = "GOOGLE",
    overrides: Parameters<typeof OAuthStateFixture.create>[0] = {},
  ) {
    const fixture = createAuthOAuthFixture(provider, { empty: true });
    const state = OAuthStateFixture.create({ provider, ...overrides });
    fixture.oauthStateRepository.states.set(state.id, state);
    const loginWithOAuthToken = new LoginWithOAuthToken(fixture);
    return {
      ...fixture,
      state,
      useCase: new CompleteOAuthAuthorization({ ...fixture, loginWithOAuthToken }),
    };
  }

  it.each(["GOOGLE", "KAKAO", "NAVER"] satisfies Array<
    Parameters<CompleteOAuthAuthorization["execute"]>[0]["provider"]
  >)(
    "%s: 공급자 교환·검증을 각 한 번 실행하고 실제 세션과 로그인 결과를 저장한다",
    async (provider) => {
      // Given
      const fixture = given(provider, provider === "KAKAO" ? { mode: null } : {});
      const metadata = { ip: "192.0.2.30", userAgent: "웹 로그인" };
      // When
      const result = await fixture.useCase.execute({
        provider,
        code: "authorization-secret",
        state: fixture.state.state,
        metadata,
      });
      // Then
      expect(fixture.identityProvider.exchanges).toEqual([
        { code: "authorization-secret", state: fixture.state.state },
      ]);
      expect(fixture.identityProvider.verifications).toEqual([
        { token: "provider-token", nonce: undefined },
      ]);
      expect(fixture.sessionRepository.sessions.size).toBe(1);
      expect(fixture.loginAttemptRepository.attempts).toMatchObject([
        { success: true, provider, ipAddress: metadata.ip, userAgent: metadata.userAgent },
      ]);
      const stored = fixture.oauthStateRepository.states.get(fixture.state.id);
      expect(stored).toMatchObject({
        exchangeCode: result.exchangeCode,
        userId: result.userId,
        userName: result.name,
        profileImage: result.profileImage,
      });
      expect(stored?.accessToken).toBeTruthy();
      expect(stored?.refreshToken).toBeTruthy();
      expect(result.redirectUri).toBe(fixture.state.redirectUri);
      expect(JSON.stringify(fixture.logger.debug.mock.calls)).not.toContain("authorization-secret");
    },
  );

  it("연결 모드는 신원만 저장하고 세션·사용자·로그인 감사를 만들지 않는다", async () => {
    // Given
    const fixture = given("GOOGLE", {
      mode: "link",
      initiatingUserId: "actor-user",
      redirectUri: "aido:///auth/link",
    });
    // When
    const result = await fixture.useCase.execute({
      provider: "GOOGLE",
      code: "code",
      state: fixture.state.state,
    });
    // Then
    expect(fixture.identityProvider.exchanges).toHaveLength(1);
    expect(fixture.identityProvider.verifications).toHaveLength(1);
    expect(fixture.oauthStateRepository.states.get(fixture.state.id)).toMatchObject({
      exchangeCode: result.exchangeCode,
      userId: fixture.identityProvider.profile.id,
      initiatingUserId: "actor-user",
      accessToken: null,
      refreshToken: null,
    });
    expect(result).toEqual({
      exchangeCode: result.exchangeCode,
      redirectUri: "aido:///auth/link",
      userId: fixture.identityProvider.profile.id,
    });
    expect(fixture.sessionRepository.sessions.size).toBe(0);
    expect(fixture.userRepository.users.size).toBe(0);
    expect(fixture.securityLogRepository.entries).toEqual([]);
  });

  it.each(["존재하지 않는", "만료된"])(
    "%s state는 공급자 요청 전에 거부한다",
    async (description) => {
      // Given
      const fixture = given(
        "GOOGLE",
        description === "만료된" ? { expiresAt: AUTH_CREDENTIAL_TIME } : {},
      );
      // When
      const pending = fixture.useCase.execute({
        provider: "GOOGLE",
        code: "code",
        state: description === "존재하지 않는" ? "missing" : fixture.state.state,
      });
      // Then
      await expect(pending).rejects.toMatchObject({ errorCode: ErrorCode.USER_0602 });
      expect(fixture.identityProvider.exchanges).toEqual([]);
      expect(fixture.identityProvider.verifications).toEqual([]);
      expect(fixture.sessionRepository.sessions.size).toBe(0);
    },
  );

  it("공급자 교환 실패를 그대로 반환하고 결과 코드를 저장하지 않는다", async () => {
    // Given
    const fixture = given();
    const providerError = new Error("교환 실패");
    fixture.identityProvider.exchangeError = providerError;
    // When
    const pending = fixture.useCase.execute({
      provider: "GOOGLE",
      code: "code",
      state: fixture.state.state,
    });
    // Then
    await expect(pending).rejects.toBe(providerError);
    expect(fixture.identityProvider.verifications).toEqual([]);
    expect(fixture.oauthStateRepository.states.get(fixture.state.id)?.exchangeCode).toBeNull();
    expect(fixture.sessionRepository.sessions.size).toBe(0);
  });

  it("빈 공급자 교환 결과는 USER_0602이고 저장된 빈 복귀 URI는 기본 주소로 응답한다", async () => {
    // Given
    const fixture = given("GOOGLE", { mode: "link", redirectUri: "" });
    fixture.identityProvider.exchangedToken = null;
    // When / Then
    await expect(
      fixture.useCase.execute({ provider: "GOOGLE", code: "code", state: fixture.state.state }),
    ).rejects.toMatchObject({ errorCode: ErrorCode.USER_0602 });
    fixture.identityProvider.exchangedToken = "provider-token";
    const result = await fixture.useCase.execute({
      provider: "GOOGLE",
      code: "code",
      state: fixture.state.state,
    });
    expect(result.redirectUri).toBe("aido://auth/callback");
  });
});
