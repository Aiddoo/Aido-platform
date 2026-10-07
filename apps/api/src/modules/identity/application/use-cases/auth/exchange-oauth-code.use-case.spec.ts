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
    });
  });
});
