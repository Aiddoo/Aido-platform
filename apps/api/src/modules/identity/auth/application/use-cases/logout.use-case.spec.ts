import { ErrorCode } from "@aido/api/errors";
import { REVOKE_REASON, SECURITY_EVENT } from "@aido/api/vocabulary";

import type { AuthSessionPrimitives } from "#api/modules/identity/auth/domain/auth-session.aggregate";
import { InMemoryAuthSecurityLogRepository } from "#test/doubles/identity/in-memory-auth-security-log.repository";
import { InMemoryAuthSessionRepository } from "#test/doubles/identity/in-memory-auth-session.repository";
import { FixedClock } from "#test/doubles/platform/fixed-clock";
import { SilentLogger } from "#test/doubles/platform/silent-logger";
import {
  AUTH_FIXTURE_NOW,
  AUTH_FIXTURE_SESSION_ID,
  AUTH_FIXTURE_USER_ID,
  createAuthSessionFixture,
} from "#test/fixtures/identity/auth-session.fixture";
import {
  StubAuthSessionCache,
  StubSessionPushDeviceReleaser,
} from "#test/mocks/ports/auth-session.stub";

import { AUTH_DEFAULTS } from "../../domain/auth.constants.js";
import { LogoutUseCase } from "./logout.use-case.js";

const userId = AUTH_FIXTURE_USER_ID;
const sessionId = AUTH_FIXTURE_SESSION_ID;

describe("Logout — 현재 기기의 세션 종료", () => {
  function givenSessions(sessions: readonly Partial<AuthSessionPrimitives>[]) {
    const sessionRepository = new InMemoryAuthSessionRepository(
      sessions.map((overrides) => createAuthSessionFixture(overrides)),
    );
    const cacheService = new StubAuthSessionCache([sessionId, "other-session"]);
    const securityLogRepository = new InMemoryAuthSecurityLogRepository();
    const pushDevices = new StubSessionPushDeviceReleaser();
    const useCase = new LogoutUseCase({
      pushDevices,
      sessionRepository,
      cacheService,
      securityLogRepository,
      clock: new FixedClock(AUTH_FIXTURE_NOW),
      logger: new SilentLogger(),
    });
    return { useCase, sessionRepository, cacheService, securityLogRepository, pushDevices };
  }

  it("현재 세션을 폐기하고 해당 캐시만 비운 뒤 기본 요청 정보로 보안 이벤트를 기록한다", async () => {
    // Given
    const fixture = givenSessions([{}]);

    // When
    const result = await fixture.useCase.execute({ userId, sessionId });

    // Then
    expect(result).toEqual({ message: "로그아웃되었습니다." });
    expect(fixture.sessionRepository.stored(sessionId)?.revokedAt).toEqual(AUTH_FIXTURE_NOW);
    expect(fixture.sessionRepository.revocationReasons).toEqual(
      new Map([[sessionId, REVOKE_REASON.USER_LOGOUT]]),
    );
    expect(fixture.cacheService.sessionIds).toEqual(new Set(["other-session"]));
    expect(fixture.pushDevices.releasedSessionIds).toEqual([sessionId]);
    expect(fixture.securityLogRepository.entries).toEqual([
      {
        userId,
        event: SECURITY_EVENT.LOGOUT,
        ipAddress: AUTH_DEFAULTS.UNKNOWN_IP,
        userAgent: AUTH_DEFAULTS.UNKNOWN_USER_AGENT,
      },
    ]);
  });

  it.each([
    { description: "존재하지 않는", sessions: [], errorCode: ErrorCode.SESSION_0701 },
    {
      description: "다른 사용자의",
      sessions: [{ userId: "other-user" }],
      errorCode: ErrorCode.SESSION_0701,
    },
    {
      description: "이미 폐기된",
      sessions: [{ revokedAt: AUTH_FIXTURE_NOW.subtract({ hours: 1 }) }],
      errorCode: ErrorCode.SESSION_0702,
    },
  ])(
    "$description 세션은 종료하지 않고 캐시와 보안 기록을 유지한다",
    async ({ sessions, errorCode }) => {
      // Given
      const fixture = givenSessions(sessions);

      // When
      const pending = fixture.useCase.execute({ userId, sessionId });

      // Then
      await expect(pending).rejects.toMatchObject({ errorCode, details: { sessionId: undefined } });
      expect(fixture.sessionRepository.revocationReasons.size).toBe(0);
      expect(fixture.cacheService.sessionIds.has(sessionId)).toBe(true);
      expect(fixture.pushDevices.releasedSessionIds).toEqual([]);
      expect(fixture.securityLogRepository.entries).toEqual([]);
    },
  );
});
