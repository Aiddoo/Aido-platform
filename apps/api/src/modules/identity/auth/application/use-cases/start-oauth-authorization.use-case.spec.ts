import { ErrorCode } from "@aido/api/errors";

import { OAUTH_STATE_EXPIRY_MINUTES } from "#api/modules/identity/auth/domain/auth.constants";
import { AUTH_CREDENTIAL_NOW } from "#test/fixtures/auth-credential.fixture";
import { createAuthOAuthFixture } from "#test/fixtures/auth-oauth.fixture";

import { StartOAuthAuthorizationUseCase } from "./start-oauth-authorization.use-case.js";

describe("StartOAuthAuthorization — 허용된 복귀 주소와 OAuth state 저장", () => {
  it.each(["GOOGLE", "KAKAO", "NAVER"] satisfies Array<
    Parameters<StartOAuthAuthorizationUseCase["execute"]>[0]["provider"]
  >)("%s 연결 요청의 actor와 복귀 주소를 저장한다", async (provider) => {
    // Given
    const fixture = createAuthOAuthFixture(provider);
    const useCase = new StartOAuthAuthorizationUseCase({
      ...fixture,
      configService: { allowsDevRedirects: false },
    });
    // When
    const result = await useCase.execute({
      provider,
      state: "state-secret",
      clientRedirectUri: "aido:///auth/link",
      mode: "link",
      initiatingUserId: fixture.user.id,
    });
    // Then
    expect(result).toBe("https://provider.example/authorize?state=state-secret");
    expect(fixture.oauthStateRepository.all).toMatchObject([
      {
        provider,
        state: "state-secret",
        redirectUri: "aido:///auth/link",
        mode: "link",
        initiatingUserId: fixture.user.id,
      },
    ]);
    expect(fixture.oauthStateRepository.all[0]?.expiresAt).toEqual(
      AUTH_CREDENTIAL_NOW.add({ minutes: OAUTH_STATE_EXPIRY_MINUTES }),
    );
  });

  it.each([
    { uri: "aido://auth/callback", development: false, expected: "aido://auth/callback" },
    {
      uri: "https://app.aido.kr/auth/callback",
      development: false,
      expected: "https://app.aido.kr/auth/callback",
    },
    { uri: "https://evil.aido.kr/callback", development: false, expected: "aido://auth/callback" },
    {
      uri: "https://app.aido.kr.evil.example/callback",
      development: false,
      expected: "aido://auth/callback",
    },
    { uri: "aido-dev:///auth/callback", development: false, expected: "aido://auth/callback" },
    {
      uri: "http://localhost:8081/auth/callback",
      development: false,
      expected: "aido://auth/callback",
    },
    { uri: "aido-dev:///auth/callback", development: true, expected: "aido-dev:///auth/callback" },
    {
      uri: "http://localhost:8081/auth/callback",
      development: true,
      expected: "http://localhost:8081/auth/callback",
    },
    {
      uri: "exp://192.0.2.1:8081/--/auth/callback",
      development: true,
      expected: "exp://192.0.2.1:8081/--/auth/callback",
    },
    { uri: "", development: false, expected: "aido://auth/callback" },
    { uri: undefined, development: false, expected: "aido://auth/callback" },
  ])(
    "$uri / development=$development: 허용 주소만 저장하고 나머지는 기본 주소로 복귀한다",
    async ({ uri, development, expected }) => {
      // Given
      const fixture = createAuthOAuthFixture();
      const useCase = new StartOAuthAuthorizationUseCase({
        ...fixture,
        configService: { allowsDevRedirects: development },
      });
      // When
      await useCase.execute({ provider: "GOOGLE", state: "state", clientRedirectUri: uri });
      // Then
      expect(fixture.oauthStateRepository.all[0]?.redirectUri).toBe(expected);
    },
  );

  it("등록되지 않은 제공자는 state를 저장하기 전에 기존 지원 오류로 거부한다", async () => {
    // Given
    const fixture = createAuthOAuthFixture();
    const useCase = new StartOAuthAuthorizationUseCase({
      ...fixture,
      configService: { allowsDevRedirects: false },
    });
    // When
    const pending = useCase.execute({ provider: "NAVER", state: "state" });
    // Then
    await expect(pending).rejects.toMatchObject({
      errorCode: ErrorCode.SOCIAL_0204,
      details: { provider: "NAVER", reason: "Unsupported provider: NAVER" },
    });
    expect(fixture.oauthStateRepository.all).toEqual([]);
  });
});
