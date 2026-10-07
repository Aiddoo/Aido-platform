import { vi } from "vitest";
import { mock } from "vitest-mock-extended";

import type { ApplicationLogger } from "#api/shared/application/ports/application-logger";
import { SessionFixture } from "#test/fixtures/index";
import {
  StubAuthSessionCache,
  StubAuthSessionRepository,
  StubAuthSecurityLogRepository,
} from "#test/mocks/ports/auth-session.stub";

import {
  AUTH_DEFAULTS,
  REVOKE_REASON,
  SECURITY_EVENT,
} from "../../../domain/constants/auth/auth.constants.js";
import { LogoutAll } from "./logout-all.use-case.js";

const currentTime = new Date("2026-12-31T23:59:00Z");
const userId = "user-123";

describe("LogoutAll — 모든 기기의 세션 종료", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(currentTime);
  });
  afterEach(() => vi.useRealTimers());

  it("내 활성 세션을 모두 폐기하고 캐시를 비우며 다른 사용자의 세션을 유지한다", async () => {
    // Given
    const sessionRepository = new StubAuthSessionRepository([
      SessionFixture.create({ userId, id: "session-1" }),
      SessionFixture.create({ userId, id: "session-2" }),
      SessionFixture.create({ userId: "other-user", id: "other-session" }),
    ]);
    const cacheService = new StubAuthSessionCache([...sessionRepository.sessions.keys()]);
    const securityLogRepository = new StubAuthSecurityLogRepository();
    const useCase = new LogoutAll({
      sessionRepository,
      cacheService,
      securityLogRepository,
      logger: mock<ApplicationLogger>(),
    });
    const metadata = { ip: "192.0.2.1", userAgent: "Aido-Test/1.0" };

    // When
    const result = await useCase.execute({ userId, metadata });

    // Then
    expect(result).toEqual({ message: "모든 기기에서 로그아웃되었습니다.", revokedCount: 2 });
    expect(sessionRepository.revocationReasons).toEqual(
      new Map([
        ["session-1", REVOKE_REASON.USER_LOGOUT_ALL],
        ["session-2", REVOKE_REASON.USER_LOGOUT_ALL],
      ]),
    );
    expect(sessionRepository.sessions.get("other-session")?.revokedAt).toBeNull();
    expect(cacheService.sessionIds).toEqual(new Set(["other-session"]));
    expect(securityLogRepository.entries).toEqual([
      {
        userId,
        event: SECURITY_EVENT.SESSION_REVOKED_ALL,
        ipAddress: metadata.ip,
        userAgent: metadata.userAgent,
        metadata: { revokedCount: 2 },
      },
    ]);
  });

  it("활성 세션이 없어도 종료 개수 0과 기본 요청 정보로 정상 응답한다", async () => {
    // Given
    const sessionRepository = new StubAuthSessionRepository();
    const cacheService = new StubAuthSessionCache();
    const securityLogRepository = new StubAuthSecurityLogRepository();
    const useCase = new LogoutAll({
      sessionRepository,
      cacheService,
      securityLogRepository,
      logger: mock<ApplicationLogger>(),
    });

    // When
    const result = await useCase.execute({ userId });

    // Then
    expect(result.revokedCount).toBe(0);
    expect(cacheService.sessionIds.size).toBe(0);
    expect(securityLogRepository.entries).toEqual([
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
