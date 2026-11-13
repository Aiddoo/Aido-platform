import type { CurrentUserPayload } from "@aido/api/contracts/auth";

import { ListActiveSessionsUseCase } from "#api/modules/identity/auth/application/use-cases/list-active-sessions.use-case";
import { RevokeSessionUseCase } from "#api/modules/identity/auth/application/use-cases/revoke-session.use-case";
import { InMemoryAuthSessionRepository } from "#test/doubles/identity/in-memory-auth-session.repository";
import { createAuthCredentialFixture } from "#test/fixtures/auth-credential.fixture";
import {
  AUTH_FIXTURE_NOW,
  AUTH_FIXTURE_USER_ID,
  createAuthSessionFixture,
} from "#test/fixtures/identity/auth-session.fixture";

import { SessionController } from "./session.controller.js";

function createSessionController(sessionRepository: InMemoryAuthSessionRepository) {
  const fixture = { ...createAuthCredentialFixture(), sessionRepository };
  return new SessionController(
    new ListActiveSessionsUseCase(fixture),
    new RevokeSessionUseCase(fixture),
  );
}

describe("SessionController — 세션 컨트롤러", () => {
  it("활성 세션 목록에서 요청한 세션만 현재 세션으로 표시한다", async () => {
    // Given
    const user: CurrentUserPayload = {
      userId: AUTH_FIXTURE_USER_ID,
      email: "user@example.com",
      sessionId: "session-current",
      role: "USER",
    };
    const controller = createSessionController(
      new InMemoryAuthSessionRepository([
        createAuthSessionFixture({ id: "session-current" }),
        createAuthSessionFixture({
          id: "session-other",
          lastUsedAt: AUTH_FIXTURE_NOW.subtract({ hours: 1 }),
        }),
      ]),
    );

    // When
    const result = await controller.getSessions(user);

    // Then
    expect(result.sessions.map(({ id, isCurrent }) => ({ id, isCurrent }))).toEqual([
      { id: "session-current", isCurrent: true },
      { id: "session-other", isCurrent: false },
    ]);
  });
});
