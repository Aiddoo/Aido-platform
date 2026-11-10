import { InMemoryAuthOAuthStateRepository } from "#test/doubles/identity/in-memory-auth-oauth-state.repository";
import { FixedClock } from "#test/doubles/platform/fixed-clock";
import { createAuthOAuthStateFixture } from "#test/fixtures/identity/auth-credential.fixture";
import { AUTH_FIXTURE_NOW } from "#test/fixtures/identity/auth-session.fixture";

import { GetOAuthRedirectUriUseCase } from "./get-oauth-redirect-uri.use-case.js";

describe("GetOAuthRedirectUri — 유효한 OAuth state의 앱 복귀 URI", () => {
  it("저장된 URI를 반환하고 존재하지 않거나 만료된 state에는 null을 반환한다", async () => {
    // Given
    const clock = new FixedClock(AUTH_FIXTURE_NOW);
    const state = createAuthOAuthStateFixture({
      redirectUri: "aido:///auth/complete",
      expiresAt: AUTH_FIXTURE_NOW.add({ minutes: 10 }),
    });
    const useCase = new GetOAuthRedirectUriUseCase({
      oauthStateRepository: new InMemoryAuthOAuthStateRepository([state]),
      clock,
    });
    // When
    const stored = await useCase.execute({ state: state.state });
    const unknown = await useCase.execute({ state: "unknown-state" });
    clock.advanceBy({ minutes: 10 });
    const expired = await useCase.execute({ state: state.state });
    // Then
    expect([stored, unknown, expired]).toEqual(["aido:///auth/complete", null, null]);
  });
});
