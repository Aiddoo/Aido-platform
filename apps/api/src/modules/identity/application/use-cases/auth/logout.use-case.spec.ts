import { ErrorCode } from "@aido/api/errors";
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
import { Logout } from "./logout.use-case.js";

const currentTime = new Date("2026-12-31T23:59:00Z");
const userId = "user-123";
const sessionId = "session-123";

describe("Logout — 현재 기기의 세션 종료", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(currentTime);
  });
  afterEach(() => vi.useRealTimers());

  function givenSession(overrides: Parameters<typeof SessionFixture.create>[0] = {}) {
    const sessionRepository = new StubAuthSessionRepository([
      SessionFixture.create({ userId, id: sessionId, ...overrides }),
    ]);
    const cacheService = new StubAuthSessionCache([sessionId, "other-session"]);
    const securityLogRepository = new StubAuthSecurityLogRepository();
    const useCase = new Logout({
      sessionRepository,
      cacheService,
      securityLogRepository,
      logger: mock<ApplicationLogger>(),
    });
    return { useCase, sessionRepository, cacheService, securityLogRepository };
  }

  it("현재 세션을 폐기하고 해당 캐시만 비운 뒤 기본 요청 정보로 보안 이벤트를 기록한다", async () => {
    // Given
    const { useCase, sessionRepository, cacheService, securityLogRepository } = givenSession();

    // When
    const result = await useCase.execute({ userId, sessionId });

    // Then
    expect(result).toEqual({ message: "로그아웃되었습니다." });
    expect(sessionRepository.sessions.get(sessionId)?.revokedAt).toEqual(currentTime);
    expect(sessionRepository.revocationReasons.get(sessionId)).toBe(REVOKE_REASON.USER_LOGOUT);
    expect(cacheService.sessionIds).toEqual(new Set(["other-session"]));
    expect(securityLogRepository.entries).toEqual([
      {
        userId,
        event: SECURITY_EVENT.LOGOUT,
        ipAddress: AUTH_DEFAULTS.UNKNOWN_IP,
        userAgent: AUTH_DEFAULTS.UNKNOWN_USER_AGENT,
      },
    ]);
  });

  it.each([
    { description: "존재하지 않는", state: "missing", errorCode: ErrorCode.SESSION_0701 },
    { description: "다른 사용자의", state: "other-owner", errorCode: ErrorCode.SESSION_0701 },
    { description: "이미 폐기된", state: "revoked", errorCode: ErrorCode.SESSION_0702 },
  ])(
    "$description 세션은 종료하지 않고 캐시와 보안 기록을 유지한다",
    async ({ state, errorCode }) => {
      // Given
      const fixture = givenSession({
        userId: state === "other-owner" ? "other-user" : userId,
        revokedAt: state === "revoked" ? currentTime : null,
      });
      if (state === "missing") fixture.sessionRepository.sessions.clear();

      // When
      const pending = fixture.useCase.execute({ userId, sessionId });

      // Then
      await expect(pending).rejects.toMatchObject({ errorCode, details: { sessionId: undefined } });
      expect(fixture.sessionRepository.revocationReasons.size).toBe(0);
      expect(fixture.cacheService.sessionIds.has(sessionId)).toBe(true);
      expect(fixture.securityLogRepository.entries).toEqual([]);
    },
  );
});
