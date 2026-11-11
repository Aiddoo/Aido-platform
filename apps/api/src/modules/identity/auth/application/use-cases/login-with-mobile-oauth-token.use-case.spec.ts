import { toIsoString } from "#api/shared/domain/time/instant";
import { AUTH_CREDENTIAL_NOW } from "#test/fixtures/auth-credential.fixture";
import { createAuthOAuthFixture } from "#test/fixtures/auth-oauth.fixture";

import { LoginWithMobileOAuthTokenUseCase } from "./login-with-mobile-oauth-token.use-case.js";
import { LoginWithOAuthTokenUseCase } from "./login-with-oauth-token.use-case.js";

describe("LoginWithMobileOAuthToken — 앱이 직접 보낸 소셜 로그인의 가입 알림", () => {
  const device = { devicePlatform: "ANDROID", appVersion: "1.14.2" } as const;

  function given(options: Parameters<typeof createAuthOAuthFixture>[1] = {}) {
    const fixture = createAuthOAuthFixture("GOOGLE", options);
    return {
      ...fixture,
      useCase: new LoginWithMobileOAuthTokenUseCase({
        ...fixture,
        loginWithOAuthToken: new LoginWithOAuthTokenUseCase(fixture),
      }),
    };
  }

  it("새 가입이면 요청의 기기 정보와 가입 시각으로 알림을 한 번 보낸다", async () => {
    // Given
    const fixture = given({ empty: true });
    // When
    const result = await fixture.useCase.execute({
      provider: "GOOGLE",
      token: "token",
      userName: "새 사용자",
      metadata: { device },
    });
    // Then
    expect(result.isNewUser).toBe(true);
    expect(fixture.adminEventNotifier.notifications).toEqual([
      {
        userId: result.userId,
        email: fixture.identityProvider.profile.email,
        provider: "google",
        registeredAt: toIsoString(AUTH_CREDENTIAL_NOW),
        name: "새 사용자",
        ...device,
      },
    ]);
  });

  it("이미 있는 계정이면 알림을 보내지 않는다", async () => {
    // Given
    const fixture = given({ empty: true });
    await fixture.useCase.execute({ provider: "GOOGLE", token: "token", metadata: { device } });
    // When
    const result = await fixture.useCase.execute({
      provider: "GOOGLE",
      token: "token",
      metadata: { device },
    });
    // Then
    expect(result.isNewUser).toBe(false);
    expect(fixture.adminEventNotifier.notifications).toHaveLength(1);
  });
});
