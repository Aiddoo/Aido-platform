import { vi } from "vitest";

import { AUTH_CREDENTIAL_TIME } from "#test/fixtures/auth-credential.fixture";
import { createAuthOAuthFixture } from "#test/fixtures/auth-oauth.fixture";
import { OAuthStateFixture } from "#test/fixtures/oauth-state.fixture";

import { GetOAuthRedirectUri } from "./get-oauth-redirect-uri.use-case.js";

describe("GetOAuthRedirectUri — 유효한 OAuth state의 앱 복귀 URI", () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(AUTH_CREDENTIAL_TIME);
  });
  afterEach(() => vi.useRealTimers());
  it("저장된 URI를 반환하고 존재하지 않거나 만료된 state에는 null을 반환한다", async () => {
    // Given
    const fixture = createAuthOAuthFixture();
    const state = OAuthStateFixture.create({ redirectUri: "aido:///auth/complete" });
    fixture.oauthStateRepository.states.set(state.id, state);
    const useCase = new GetOAuthRedirectUri(fixture);
    // When / Then
    expect(await useCase.execute({ state: state.state })).toBe(state.redirectUri);
    expect(await useCase.execute({ state: "unknown-state" })).toBeNull();
    vi.setSystemTime(state.expiresAt);
    expect(await useCase.execute({ state: state.state })).toBeNull();
  });
});
