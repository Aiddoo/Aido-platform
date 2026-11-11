import { InMemoryAuthSessionRepository } from "#test/doubles/identity/in-memory-auth-session.repository";
import { FixedClock } from "#test/doubles/platform/fixed-clock";
import {
  AUTH_FIXTURE_NOW,
  AUTH_FIXTURE_USER_ID,
  createAuthSessionFixture,
} from "#test/fixtures/identity/auth-session.fixture";

import { ListActiveSessionsUseCase } from "./list-active-sessions.use-case.js";

const userId = AUTH_FIXTURE_USER_ID;

describe("ListActiveSessions — 내 활성 기기 목록", () => {
  it("활성 세션의 날짜·기기 정보를 기존 응답 형식으로 매핑하고 토큰 정보를 노출하지 않는다", async () => {
    // Given
    const sessionRepository = new InMemoryAuthSessionRepository([
      createAuthSessionFixture({
        id: "my-session",
        ipAddress: "192.0.2.1",
        userAgent: "Chrome/120",
        createdAt: AUTH_FIXTURE_NOW.subtract({ hours: 1 }),
      }),
      createAuthSessionFixture({ id: "other-session", userId: "other-user" }),
      createAuthSessionFixture({ id: "revoked-session", revokedAt: AUTH_FIXTURE_NOW }),
      createAuthSessionFixture({
        id: "expired-session",
        expiresAt: AUTH_FIXTURE_NOW.subtract({ milliseconds: 1 }),
      }),
    ]);
    const useCase = new ListActiveSessionsUseCase({
      sessionRepository,
      clock: new FixedClock(AUTH_FIXTURE_NOW),
    });

    // When
    const result = await useCase.execute({ userId });

    // Then
    expect(result).toEqual([
      {
        id: "my-session",
        deviceName: null,
        deviceType: null,
        ipAddress: "192.0.2.1",
        userAgent: "Chrome/120",
        lastActiveAt: "2026-11-10T00:00:00.000Z",
        createdAt: "2026-11-09T23:00:00.000Z",
        isCurrent: false,
      },
    ]);
  });

  it("내 활성 세션이 없으면 빈 목록을 반환한다", async () => {
    // Given
    const useCase = new ListActiveSessionsUseCase({
      sessionRepository: new InMemoryAuthSessionRepository(),
      clock: new FixedClock(AUTH_FIXTURE_NOW),
    });

    // When
    const result = await useCase.execute({ userId });

    // Then
    expect(result).toEqual([]);
  });
});
