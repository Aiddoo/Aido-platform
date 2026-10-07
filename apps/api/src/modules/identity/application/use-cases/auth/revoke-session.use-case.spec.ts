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

import { REVOKE_REASON, SECURITY_EVENT } from "../../../domain/constants/auth/auth.constants.js";
import { RevokeSession } from "./revoke-session.use-case.js";

const currentTime = new Date("2026-12-31T23:59:00Z");
const userId = "user-123";
const sessionId = "session-123";

describe("RevokeSession — 지정한 기기의 세션 종료", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(currentTime);
  });
  afterEach(() => vi.useRealTimers());

  function givenSessions(sessions: ConstructorParameters<typeof StubAuthSessionRepository>[0]) {
    const sessionRepository = new StubAuthSessionRepository(sessions);
    const cacheService = new StubAuthSessionCache([sessionId, "current-session"]);
    const securityLogRepository = new StubAuthSecurityLogRepository();
    const useCase = new RevokeSession({
      sessionRepository,
      cacheService,
      securityLogRepository,
      logger: mock<ApplicationLogger>(),
    });
    return { useCase, sessionRepository, cacheService, securityLogRepository };
  }

  it("원격 세션을 폐기하고 현재 기기 캐시는 유지하며 전달받은 요청 정보를 기록한다", async () => {
    // Given
    const fixture = givenSessions([SessionFixture.create({ userId, id: sessionId })]);
    const metadata = { ip: "192.0.2.1", userAgent: "Aido-Test/1.0" };

    // When
    const result = await fixture.useCase.execute({ userId, sessionId, metadata });

    // Then
    expect(result).toEqual({ message: "세션이 종료되었습니다." });
    expect(fixture.sessionRepository.sessions.get(sessionId)?.revokedAt).toEqual(currentTime);
    expect(fixture.sessionRepository.revocationReasons.get(sessionId)).toBe(
      REVOKE_REASON.USER_REVOKE,
    );
    expect(fixture.cacheService.sessionIds).toEqual(new Set(["current-session"]));
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

  it.each(["존재하지 않는", "다른 사용자의"])("%s 세션은 변경하지 않는다", async (scenario) => {
    // Given
    const fixture = givenSessions(
      scenario === "존재하지 않는"
        ? []
        : [SessionFixture.create({ id: sessionId, userId: "other-user" })],
    );

    // When
    const pending = fixture.useCase.execute({ userId, sessionId });

    // Then
    await expect(pending).rejects.toMatchObject({
      errorCode: ErrorCode.SESSION_0701,
      details: { sessionId: undefined },
    });
    expect(fixture.sessionRepository.revocationReasons.size).toBe(0);
    expect(fixture.cacheService.sessionIds.has(sessionId)).toBe(true);
    expect(fixture.securityLogRepository.entries).toEqual([]);
  });
});
