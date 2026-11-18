import { ErrorCode } from "@aido/api/errors";

import type { SessionPrimitives } from "#api/modules/identity/sessions/domain/session.aggregate";
import { REVOKE_REASON } from "#api/modules/identity/sessions/domain/sessions.constants";
import { SECURITY_EVENT } from "#api/modules/identity/users/domain/users.constants";
import { InMemorySecurityLogRepository } from "#test/doubles/identity/in-memory-security-log.repository";
import { InMemorySessionRepository } from "#test/doubles/identity/in-memory-session.repository";
import {
  StubSessionCache,
  StubSessionPushDeviceReleaser,
} from "#test/doubles/identity/stub-auth-session";
import { FixedClock } from "#test/doubles/platform/fixed-clock";
import { SilentLogger } from "#test/doubles/platform/silent-logger";
import {
  AUTH_FIXTURE_NOW,
  AUTH_FIXTURE_SESSION_ID,
  AUTH_FIXTURE_USER_ID,
  createSessionFixture,
} from "#test/fixtures/identity/session.fixture";

import { REQUEST_ORIGIN_DEFAULTS } from "../../../shared/domain/request-metadata.constants.js";
import { LogoutUseCase } from "./logout.use-case.js";

const userId = AUTH_FIXTURE_USER_ID;
const sessionId = AUTH_FIXTURE_SESSION_ID;

describe("Logout — 현재 기기의 세션 종료", () => {
  function givenSessions(sessions: readonly Partial<SessionPrimitives>[]) {
    const sessionRepository = new InMemorySessionRepository(
      sessions.map((overrides) => createSessionFixture(overrides)),
    );
    const cacheService = new StubSessionCache([sessionId, "other-session"]);
    const securityLogRepository = new InMemorySecurityLogRepository();
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
        ipAddress: REQUEST_ORIGIN_DEFAULTS.UNKNOWN_IP,
        userAgent: REQUEST_ORIGIN_DEFAULTS.UNKNOWN_USER_AGENT,
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
