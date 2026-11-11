import { ErrorCode } from "@aido/api/errors";
import { REVOKE_REASON, SECURITY_EVENT } from "@aido/api/vocabulary";

import type { AuthSessionPrimitives } from "#api/modules/identity/auth/domain/auth-session.aggregate";
import { InMemoryAuthSecurityLogRepository } from "#test/doubles/identity/in-memory-auth-security-log.repository";
import { InMemoryAuthSessionRepository } from "#test/doubles/identity/in-memory-auth-session.repository";
import { FixedClock } from "#test/doubles/platform/fixed-clock";
import { SilentLogger } from "#test/doubles/platform/silent-logger";
import {
  AUTH_FIXTURE_NOW,
  AUTH_FIXTURE_USER_ID,
  createAuthSessionFixture,
} from "#test/fixtures/identity/auth-session.fixture";
import {
  StubAuthSessionCache,
  StubSessionPushDeviceReleaser,
} from "#test/mocks/ports/auth-session.stub";

import { RevokeSessionUseCase } from "./revoke-session.use-case.js";

const userId = AUTH_FIXTURE_USER_ID;
const sessionId = "remote-session";

describe("RevokeSession — 지정한 기기의 세션 종료", () => {
  function givenSessions(sessions: readonly Partial<AuthSessionPrimitives>[]) {
    const sessionRepository = new InMemoryAuthSessionRepository([
      createAuthSessionFixture({ id: "current-session" }),
      ...sessions.map((overrides) => createAuthSessionFixture({ id: sessionId, ...overrides })),
    ]);
    const cacheService = new StubAuthSessionCache([sessionId, "current-session"]);
    const securityLogRepository = new InMemoryAuthSecurityLogRepository();
    const pushDevices = new StubSessionPushDeviceReleaser();
    const useCase = new RevokeSessionUseCase({
      pushDevices,
      sessionRepository,
      cacheService,
      securityLogRepository,
      clock: new FixedClock(AUTH_FIXTURE_NOW),
      logger: new SilentLogger(),
    });
    return { useCase, sessionRepository, cacheService, securityLogRepository, pushDevices };
  }

  it("원격 세션을 폐기하고 현재 기기 캐시는 유지하며 전달받은 요청 정보를 기록한다", async () => {
    // Given
    const fixture = givenSessions([{}]);
    const metadata = { ip: "192.0.2.1", userAgent: "Aido-Test/1.0" };

    // When
    const result = await fixture.useCase.execute({ userId, sessionId, metadata });

    // Then
    expect(result).toEqual({ message: "세션이 종료되었습니다." });
    expect(fixture.sessionRepository.stored(sessionId)?.revokedAt).toEqual(AUTH_FIXTURE_NOW);
    expect(fixture.sessionRepository.stored("current-session")?.revokedAt).toBeNull();
    expect(fixture.sessionRepository.revocationReasons).toEqual(
      new Map([[sessionId, REVOKE_REASON.USER_REVOKE]]),
    );
    expect(fixture.cacheService.sessionIds).toEqual(new Set(["current-session"]));
    expect(fixture.pushDevices.releasedSessionIds).toEqual([sessionId]);
    expect(fixture.securityLogRepository.entries).toEqual([
      {
        userId,
        event: SECURITY_EVENT.SESSION_REVOKED,
        ipAddress: metadata.ip,
        userAgent: metadata.userAgent,
        metadata: { revokedSessionId: sessionId },
      },
    ]);
  });

  it.each([
    { description: "존재하지 않는", sessions: [] },
    { description: "다른 사용자의", sessions: [{ userId: "other-user" }] },
  ])("$description 세션은 변경하지 않는다", async ({ sessions }) => {
    // Given
    const fixture = givenSessions(sessions);

    // When
    const pending = fixture.useCase.execute({ userId, sessionId });

    // Then
    await expect(pending).rejects.toMatchObject({
      errorCode: ErrorCode.SESSION_0701,
      details: { sessionId: undefined },
    });
    expect(fixture.sessionRepository.revocationReasons.size).toBe(0);
    expect(fixture.cacheService.sessionIds.has(sessionId)).toBe(true);
    expect(fixture.pushDevices.releasedSessionIds).toEqual([]);
    expect(fixture.securityLogRepository.entries).toEqual([]);
  });
});
