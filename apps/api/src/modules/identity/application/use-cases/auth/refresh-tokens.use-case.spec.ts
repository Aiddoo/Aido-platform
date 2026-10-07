import { ErrorCode } from "@aido/api/errors";
import { vi } from "vitest";
import { mock } from "vitest-mock-extended";

import type { ApplicationLogger } from "#api/shared/application/ports/application-logger";
import { SessionFixture } from "#test/fixtures/index";
import {
  StubAuthSessionCache,
  StubAuthSessionRepository,
  StubAuthSecurityLogRepository,
  StubAuthTokenIssuer,
} from "#test/mocks/ports/auth-session.stub";

import {
  AUTH_DEFAULTS,
  REVOKE_REASON,
  SECURITY_EVENT,
} from "../../../domain/constants/auth/auth.constants.js";
import type { VerifiedRefreshPayload } from "../../types/auth/index.js";
import { RefreshTokens } from "./refresh-tokens.use-case.js";

const currentTime = new Date("2026-12-31T23:59:00Z");
const userId = "user-123";
const sessionId = "session-123";
const refreshToken = "refresh-token";
const verifiedPayload: VerifiedRefreshPayload = {
  userId,
  sessionId,
  email: "test@example.com",
  role: "USER",
};

describe("RefreshTokens — 세션 연장과 Refresh Token 재사용 방어", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(currentTime);
  });
  afterEach(() => vi.useRealTimers());

  function givenSession(overrides: Parameters<typeof SessionFixture.create>[0] = {}) {
    const tokenService = new StubAuthTokenIssuer();
    const sessionRepository = new StubAuthSessionRepository([
      SessionFixture.create({
        userId,
        id: sessionId,
        tokenFamily: "family-id",
        refreshTokenHash: tokenService.hashRefreshToken(refreshToken),
        ...overrides,
      }),
    ]);
    const cacheService = new StubAuthSessionCache([sessionId]);
    const securityLogRepository = new StubAuthSecurityLogRepository();
    const logger = mock<ApplicationLogger>();
    const useCase = new RefreshTokens({
      sessionRepository,
      tokenService,
      cacheService,
      securityLogRepository,
      logger,
    });
    return {
      useCase,
      sessionRepository,
      tokenService,
      cacheService,
      securityLogRepository,
      logger,
    };
  }

  it("현재 토큰을 회전하고 새 만료 시간을 저장하여 세션 캐시를 비우고 기본 요청 정보를 기록한다", async () => {
    // Given
    const fixture = givenSession({ expiresAt: currentTime });

    // When
    const result = await fixture.useCase.execute({ refreshToken, verifiedPayload });

    // Then
    expect(result).toEqual({
      sessionId,
      tokens: {
        accessToken: `access:${sessionId}:2`,
        refreshToken: `refresh:${sessionId}:2`,
        expiresIn: 900,
      },
    });
    expect(fixture.sessionRepository.sessions.get(sessionId)).toEqual(
      expect.objectContaining({
        refreshTokenHash: fixture.tokenService.hashRefreshToken(result.tokens.refreshToken),
        previousTokenHash: fixture.tokenService.hashRefreshToken(refreshToken),
        tokenVersion: 2,
        expiresAt: new Date(
          currentTime.getTime() + fixture.tokenService.refreshTokenExpiresInSeconds * 1000,
        ),
        lastUsedAt: currentTime,
      }),
    );
    expect(fixture.tokenService.issued).toEqual([
      { ...verifiedPayload, tokenFamily: "family-id", tokenVersion: 2 },
    ]);
    expect(fixture.cacheService.sessionIds.size).toBe(0);
    expect(fixture.securityLogRepository.entries).toEqual([
      {
        userId,
        event: SECURITY_EVENT.TOKEN_REFRESH,
        ipAddress: AUTH_DEFAULTS.UNKNOWN_IP,
        userAgent: AUTH_DEFAULTS.UNKNOWN_USER_AGENT,
      },
    ]);
    const logs = JSON.stringify([
      ...fixture.logger.debug.mock.calls,
      ...fixture.logger.warn.mock.calls,
    ]);
    expect(logs).not.toContain(refreshToken);
    expect(logs).not.toContain(result.tokens.accessToken);
  });

  it.each([5_000, 10_000])(
    "로테이션 후 %i ms의 이전 토큰은 네트워크 재시도로 한 번 회전한다",
    async (elapsedMilliseconds) => {
      // Given
      const fixture = givenSession({
        refreshTokenHash: "digest:current-token",
        previousTokenHash: "digest:refresh-token",
        tokenVersion: 2,
        lastUsedAt: new Date(currentTime.getTime() - elapsedMilliseconds),
      });
      const metadata = { ip: "192.0.2.1", userAgent: "Aido-Test/1.0" };

      // When
      const result = await fixture.useCase.execute({ refreshToken, verifiedPayload, metadata });

      // Then
      expect(result.tokens.refreshToken).toBe(`refresh:${sessionId}:3`);
      expect(fixture.sessionRepository.sessions.get(sessionId)).toEqual(
        expect.objectContaining({ tokenVersion: 3, previousTokenHash: "digest:current-token" }),
      );
      expect(fixture.sessionRepository.revocationReasons.size).toBe(0);
      expect(fixture.cacheService.sessionIds.size).toBe(0);
      expect(fixture.securityLogRepository.entries).toEqual([
        {
          userId,
          event: SECURITY_EVENT.TOKEN_REFRESH,
          ipAddress: metadata.ip,
          userAgent: metadata.userAgent,
          metadata: { retryWithinGracePeriod: true },
        },
      ]);
    },
  );

  it("이전 토큰의 grace 재시도가 끝나면 같은 옛 토큰을 다시 사용할 수 없다", async () => {
    // Given
    const fixture = givenSession();
    const input = { refreshToken, verifiedPayload };
    await fixture.useCase.execute(input);
    await fixture.useCase.execute(input);

    // When
    const pending = fixture.useCase.execute(input);

    // Then
    await expect(pending).rejects.toMatchObject({
      errorCode: ErrorCode.SESSION_0701,
      details: { sessionId: undefined },
    });
    expect(fixture.sessionRepository.sessions.get(sessionId)?.tokenVersion).toBe(3);
    expect(fixture.tokenService.issued).toHaveLength(2);
    expect(fixture.securityLogRepository.entries).toHaveLength(2);
    expect(fixture.sessionRepository.revocationReasons.size).toBe(0);
  });

  it("10초를 초과한 이전 토큰은 패밀리를 폐기하고 영향을 받은 모든 세션의 캐시를 비운다", async () => {
    // Given
    const fixture = givenSession({
      refreshTokenHash: "digest:current-token",
      previousTokenHash: "digest:refresh-token",
      lastUsedAt: new Date(currentTime.getTime() - 10_001),
    });
    fixture.sessionRepository.sessions.set(
      "family-peer",
      SessionFixture.create({ userId, id: "family-peer", tokenFamily: "family-id" }),
    );
    fixture.sessionRepository.sessions.set(
      "other-family",
      SessionFixture.create({ userId, id: "other-family", tokenFamily: "other-family-id" }),
    );
    fixture.cacheService.sessionIds.add("family-peer");
    fixture.cacheService.sessionIds.add("other-family");

    // When
    const pending = fixture.useCase.execute({ refreshToken, verifiedPayload });

    // Then
    await expect(pending).rejects.toMatchObject({
      errorCode: ErrorCode.SESSION_0704,
      details: { tokenFamily: undefined },
    });
    expect(fixture.sessionRepository.revocationReasons).toEqual(
      new Map([
        [sessionId, REVOKE_REASON.TOKEN_REUSE_DETECTED],
        ["family-peer", REVOKE_REASON.TOKEN_REUSE_DETECTED],
      ]),
    );
    expect(fixture.cacheService.sessionIds).toEqual(new Set(["other-family"]));
    expect(fixture.sessionRepository.sessions.get("other-family")?.revokedAt).toBeNull();
    expect(fixture.tokenService.issued).toEqual([]);
    expect(fixture.securityLogRepository.entries).toEqual([
      {
        userId,
        event: SECURITY_EVENT.SUSPICIOUS_ACTIVITY,
        ipAddress: AUTH_DEFAULTS.UNKNOWN_IP,
        userAgent: AUTH_DEFAULTS.UNKNOWN_USER_AGENT,
        metadata: { reason: REVOKE_REASON.TOKEN_REUSE_DETECTED, tokenFamily: "family-id" },
      },
    ]);
  });

  it.each([
    {
      description: "폐기된",
      revokedAt: currentTime,
      expiresAt: new Date(currentTime.getTime() + 60_000),
      errorCode: ErrorCode.SESSION_0703,
      details: { sessionId: undefined, reason: undefined },
    },
    {
      description: "만료된",
      revokedAt: null,
      expiresAt: new Date(currentTime.getTime() - 1),
      errorCode: ErrorCode.SESSION_0702,
      details: { sessionId: undefined },
    },
  ])(
    "$description 세션은 토큰·캐시·보안 기록을 변경하지 않고 기존 오류를 반환한다",
    async ({ revokedAt, expiresAt, errorCode, details }) => {
      // Given
      const fixture = givenSession({ revokedAt, expiresAt });

      // When
      const pending = fixture.useCase.execute({ refreshToken, verifiedPayload });

      // Then
      await expect(pending).rejects.toMatchObject({ errorCode, details });
      expect(fixture.tokenService.issued).toEqual([]);
      expect(fixture.cacheService.sessionIds.has(sessionId)).toBe(true);
      expect(fixture.securityLogRepository.entries).toEqual([]);
      expect(fixture.sessionRepository.sessions.get(sessionId)?.tokenVersion).toBe(1);
    },
  );

  it.each([
    { description: "현재 토큰의 사용자", overrides: { userId: "other-user" } },
    { description: "현재 토큰의 세션 ID", overrides: { id: "other-session" } },
    {
      description: "grace 재시도의 사용자",
      overrides: {
        userId: "other-user",
        refreshTokenHash: "digest:current-token",
        previousTokenHash: "digest:refresh-token",
      },
    },
  ])("$description가 검증된 페이로드와 다르면 발급하지 않는다", async ({ overrides }) => {
    // Given
    const fixture = givenSession(overrides);

    // When
    const pending = fixture.useCase.execute({ refreshToken, verifiedPayload });

    // Then
    await expect(pending).rejects.toMatchObject({
      errorCode: ErrorCode.SESSION_0701,
      details: { sessionId: undefined },
    });
    expect(fixture.tokenService.issued).toEqual([]);
    expect(fixture.securityLogRepository.entries).toEqual([]);
  });

  it.each(["세션 ID 누락", "세션 없음", "이전 토큰 불일치"])(
    "%s이면 기존 세션을 폐기하지 않고 인증을 거부한다",
    async (scenario) => {
      // Given
      const fixture = givenSession({ refreshTokenHash: "digest:current-token" });
      if (scenario === "세션 없음") fixture.sessionRepository.sessions.clear();
      const payload =
        scenario === "세션 ID 누락" ? { ...verifiedPayload, sessionId: "" } : verifiedPayload;

      // When
      const pending = fixture.useCase.execute({ refreshToken, verifiedPayload: payload });

      // Then
      await expect(pending).rejects.toMatchObject({
        errorCode: ErrorCode.SESSION_0701,
        details: { sessionId: undefined },
      });
      expect(fixture.sessionRepository.revocationReasons.size).toBe(0);
      expect(fixture.tokenService.issued).toEqual([]);
      expect(fixture.securityLogRepository.entries).toEqual([]);
    },
  );

  it("조건부 회전 쓰기가 실패하면 발급 결과를 반환하거나 캐시를 비우지 않는다", async () => {
    // Given
    const fixture = givenSession();
    fixture.sessionRepository.rejectRotation = true;

    // When
    const pending = fixture.useCase.execute({ refreshToken, verifiedPayload });

    // Then
    await expect(pending).rejects.toMatchObject({
      errorCode: ErrorCode.SESSION_0702,
      details: { sessionId: undefined },
    });
    expect(fixture.sessionRepository.sessions.get(sessionId)?.tokenVersion).toBe(1);
    expect(fixture.cacheService.sessionIds.has(sessionId)).toBe(true);
    expect(fixture.securityLogRepository.entries).toEqual([]);
  });
});
