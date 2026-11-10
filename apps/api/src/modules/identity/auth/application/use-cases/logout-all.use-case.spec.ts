import { REVOKE_REASON, SECURITY_EVENT } from "@aido/api/vocabulary";

import type { AuthSession } from "#api/modules/identity/auth/domain/auth-session.aggregate";
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

import { AUTH_DEFAULTS } from "../../domain/auth.constants.js";
import { LogoutAllUseCase } from "./logout-all.use-case.js";

const userId = AUTH_FIXTURE_USER_ID;

describe("LogoutAll — 모든 기기의 세션 종료", () => {
  function givenSessions(sessions: readonly AuthSession[] = []) {
    const sessionRepository = new InMemoryAuthSessionRepository(sessions);
    const cacheService = new StubAuthSessionCache(sessions.map((session) => session.id.value));
    const securityLogRepository = new InMemoryAuthSecurityLogRepository();
    const pushDevices = new StubSessionPushDeviceReleaser();
    const useCase = new LogoutAllUseCase({
      pushDevices,
      sessionRepository,
      cacheService,
      securityLogRepository,
      clock: new FixedClock(AUTH_FIXTURE_NOW),
      logger: new SilentLogger(),
    });
    return { useCase, sessionRepository, cacheService, securityLogRepository, pushDevices };
  }

  it("만료된 세션을 포함해 내 미폐기 세션과 캐시를 비우고 다른 사용자는 유지한다", async () => {
    // Given
    const fixture = givenSessions([
      createAuthSessionFixture({ id: "session-1" }),
      createAuthSessionFixture({ id: "session-2" }),
      createAuthSessionFixture({
        id: "expired-session",
        expiresAt: AUTH_FIXTURE_NOW.subtract({ milliseconds: 1 }),
      }),
      createAuthSessionFixture({ id: "other-session", userId: "other-user" }),
    ]);
    const metadata = { ip: "192.0.2.1", userAgent: "Aido-Test/1.0" };

    // When
    const result = await fixture.useCase.execute({ userId, metadata });

    // Then
    expect(result).toEqual({ message: "모든 기기에서 로그아웃되었습니다.", revokedCount: 3 });
    expect(fixture.sessionRepository.revocationReasons).toEqual(
      new Map([
        ["session-1", REVOKE_REASON.USER_LOGOUT_ALL],
        ["session-2", REVOKE_REASON.USER_LOGOUT_ALL],
        ["expired-session", REVOKE_REASON.USER_LOGOUT_ALL],
      ]),
    );
    expect(fixture.sessionRepository.stored("session-1")?.revokedAt).toEqual(AUTH_FIXTURE_NOW);
    expect(fixture.sessionRepository.stored("other-session")?.revokedAt).toBeNull();
    expect(fixture.cacheService.sessionIds).toEqual(new Set(["other-session"]));
    expect(fixture.pushDevices.releasedSessionIds).toEqual([
      "session-1",
      "session-2",
      "expired-session",
    ]);
    expect(fixture.securityLogRepository.entries).toEqual([
      {
        userId,
        event: SECURITY_EVENT.SESSION_REVOKED_ALL,
        ipAddress: metadata.ip,
        userAgent: metadata.userAgent,
        metadata: { revokedCount: 3 },
      },
    ]);
  });

  it("활성 세션이 없어도 종료 개수 0과 기본 요청 정보로 정상 응답한다", async () => {
    // Given
    const fixture = givenSessions();

    // When
    const result = await fixture.useCase.execute({ userId });

    // Then
    expect(result.revokedCount).toBe(0);
    expect(fixture.pushDevices.releasedSessionIds).toEqual([]);
    expect(fixture.securityLogRepository.entries).toEqual([
      {
        userId,
        event: SECURITY_EVENT.SESSION_REVOKED_ALL,
        ipAddress: AUTH_DEFAULTS.UNKNOWN_IP,
        userAgent: AUTH_DEFAULTS.UNKNOWN_USER_AGENT,
        metadata: { revokedCount: 0 },
      },
    ]);
  });
});
