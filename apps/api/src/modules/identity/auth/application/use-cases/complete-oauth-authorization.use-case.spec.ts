import { ErrorCode } from "@aido/api/errors";

import type { AuthOAuthStatePrimitives } from "#api/modules/identity/auth/domain/auth-oauth-state.aggregate";
import { InMemoryAuthOAuthStateRepository } from "#test/doubles/identity/in-memory-auth-oauth-state.repository";
import { AUTH_CREDENTIAL_NOW } from "#test/fixtures/auth-credential.fixture";
import { createAuthOAuthFixture } from "#test/fixtures/auth-oauth.fixture";
import { createAuthOAuthStateFixture } from "#test/fixtures/identity/auth-credential.fixture";

import { CompleteOAuthAuthorizationUseCase } from "./complete-oauth-authorization.use-case.js";
import { LoginWithOAuthTokenUseCase } from "./login-with-oauth-token.use-case.js";

describe("CompleteOAuthAuthorization — 코드 교환부터 실제 로그인까지", () => {
  function given(
    provider: Parameters<CompleteOAuthAuthorizationUseCase["execute"]>[0]["provider"] = "GOOGLE",
    overrides: Partial<AuthOAuthStatePrimitives> = {},
  ) {
    const fixture = createAuthOAuthFixture(provider, { empty: true });
    const state = createAuthOAuthStateFixture({ provider, ...overrides });
    const oauthStateRepository = new InMemoryAuthOAuthStateRepository([state]);
    const loginWithOAuthToken = new LoginWithOAuthTokenUseCase(fixture);
    return {
      ...fixture,
      oauthStateRepository,
      state,
      storedState: () => oauthStateRepository.all.find(({ id }) => id === state.id.value),
      useCase: new CompleteOAuthAuthorizationUseCase({
        ...fixture,
        oauthStateRepository,
        loginWithOAuthToken,
      }),
    };
  }

  it.each(["GOOGLE", "KAKAO", "NAVER"] satisfies Array<
    Parameters<CompleteOAuthAuthorizationUseCase["execute"]>[0]["provider"]
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
      expect(fixture.sessionRepository.all).toHaveLength(1);
      expect(fixture.loginAttemptRepository.attempts).toMatchObject([
        { success: true, provider, ipAddress: metadata.ip, userAgent: metadata.userAgent },
      ]);
      const stored = fixture.storedState();
      expect(stored).toMatchObject({
        exchangeCode: result.exchangeCode,
        userId: result.userId,
        userName: result.name,
        profileImage: result.profileImage,
        isNewUser: true,
      });
      expect(fixture.sessionRepository.all[0]?.refreshTokenHash).toBe(
        `digest:${stored?.refreshToken}`,
      );
      expect(stored?.accessToken).toBeTruthy();
      expect(result.redirectUri).toBe(fixture.state.redirectUri);
      expect(JSON.stringify(fixture.logger.messages)).not.toContain("authorization-secret");
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
    expect(fixture.storedState()).toMatchObject({
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
    expect(fixture.sessionRepository.all).toEqual([]);
    expect(fixture.userRepository.all).toEqual([]);
    expect(fixture.securityLogRepository.entries).toEqual([]);
  });

  it.each(["존재하지 않는", "만료된"])(
    "%s state는 공급자 요청 전에 거부한다",
    async (description) => {
      // Given
      const fixture = given(
        "GOOGLE",
        description === "만료된" ? { expiresAt: AUTH_CREDENTIAL_NOW } : {},
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
      expect(fixture.sessionRepository.all).toEqual([]);
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
    expect(fixture.storedState()?.exchangeCode).toBeNull();
    expect(fixture.sessionRepository.all).toEqual([]);
  });

  it("빈 공급자 교환 결과는 USER_0602이고 결과 코드를 저장하지 않는다", async () => {
    // Given
    const fixture = given("GOOGLE", { mode: "link" });
    fixture.identityProvider.exchangedToken = null;
    // When
    const pending = fixture.useCase.execute({
      provider: "GOOGLE",
      code: "code",
      state: fixture.state.state,
    });
    // Then
    await expect(pending).rejects.toMatchObject({ errorCode: ErrorCode.USER_0602 });
    expect(fixture.identityProvider.verifications).toEqual([]);
    expect(fixture.storedState()?.exchangeCode).toBeNull();
  });

  it("저장된 복귀 URI가 비어 있으면 기본 앱 주소로 응답한다", async () => {
    // Given
    const fixture = given("GOOGLE", { mode: "link", redirectUri: "" });
    // When
    const result = await fixture.useCase.execute({
      provider: "GOOGLE",
      code: "code",
      state: fixture.state.state,
    });
    // Then
    expect(result.redirectUri).toBe("aido://auth/callback");
  });

  it("웹 콜백은 브라우저 요청이라 새 가입이어도 알림을 보내지 않고 교환 결과에 새 가입을 남긴다", async () => {
    // Given
    const fixture = given("KAKAO");
    // When
    await fixture.useCase.execute({
      provider: "KAKAO",
      code: "authorization-secret",
      state: fixture.state.state,
      metadata: { ip: "192.0.2.30", userAgent: "Mozilla/5.0" },
    });
    // Then
    expect(fixture.adminEventNotifier.notifications).toEqual([]);
    expect(fixture.storedState()?.isNewUser).toBe(true);
  });
});
