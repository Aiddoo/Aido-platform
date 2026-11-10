import { ErrorCode } from "@aido/api/errors";
import { REVOKE_REASON, SECURITY_EVENT } from "@aido/api/vocabulary";

import type {
  AuthSession,
  AuthSessionPrimitives,
  AuthSessionRotation,
} from "#api/modules/identity/auth/domain/auth-session.aggregate";
import { InMemoryAuthSecurityLogRepository } from "#test/doubles/identity/in-memory-auth-security-log.repository";
import { InMemoryAuthSessionRepository } from "#test/doubles/identity/in-memory-auth-session.repository";
import { FixedClock } from "#test/doubles/platform/fixed-clock";
import { RecordingOperationalAlert } from "#test/doubles/platform/recording-operational-alert";
import { SilentLogger } from "#test/doubles/platform/silent-logger";
import {
  AUTH_FIXTURE_NOW,
  AUTH_FIXTURE_SESSION_ID,
  AUTH_FIXTURE_USER_ID,
  createAuthSessionFixture,
} from "#test/fixtures/identity/auth-session.fixture";
import {
  StubAuthSessionCache,
  StubAuthTokenIssuer,
  StubSessionPushDeviceReleaser,
} from "#test/mocks/ports/auth-session.stub";

import { AUTH_DEFAULTS } from "../../domain/auth.constants.js";
import { AuthAlerts } from "../auth.alerts.js";
import { AuthLogEvent } from "../auth.log-events.js";
import type { VerifiedRefreshPayload } from "../read-models/auth-result.read-model.js";
import { RefreshTokensUseCase } from "./refresh-tokens.use-case.js";

const userId = AUTH_FIXTURE_USER_ID;
const sessionId = AUTH_FIXTURE_SESSION_ID;
const refreshToken = "refresh-token";
const verifiedPayload: VerifiedRefreshPayload = {
  userId,
  sessionId,
  email: "test@example.com",
  role: "USER",
};

function sessionWith(overrides: Partial<AuthSessionPrimitives> = {}): AuthSession {
  return createAuthSessionFixture({
    id: sessionId,
    tokenFamily: "family-id",
    refreshTokenHash: `digest:${refreshToken}`,
    ...overrides,
  });
}

// 조회와 조건부 쓰기 사이에 같은 토큰으로 온 다른 요청이 먼저 회전한 경합을 만든다
class RotationRaceSessionRepository extends InMemoryAuthSessionRepository {
  override async rotateToken(
    id: string,
    rotation: AuthSessionRotation,
    now: Temporal.Instant,
  ): Promise<boolean> {
    await super.rotateToken(id, { ...rotation, refreshTokenHash: "digest:winner-token" }, now);
    return super.rotateToken(id, rotation, now);
  }
}

describe("RefreshTokens — 세션 연장과 Refresh Token 재사용 방어", () => {
  function given(
    sessions: readonly AuthSession[] = [sessionWith()],
    sessionRepository = new InMemoryAuthSessionRepository(sessions),
  ) {
    const tokenService = new StubAuthTokenIssuer();
    const cacheService = new StubAuthSessionCache(sessions.map((session) => session.id.value));
    const securityLogRepository = new InMemoryAuthSecurityLogRepository();
    const logger = new SilentLogger();
    const pushDevices = new StubSessionPushDeviceReleaser();
    const alert = new RecordingOperationalAlert();
    const useCase = new RefreshTokensUseCase({
      clock: new FixedClock(AUTH_FIXTURE_NOW),
      pushDevices,
      sessionRepository,
      tokenService,
      cacheService,
      securityLogRepository,
      logger,
      alert,
    });
    return {
      useCase,
      alert,
      sessionRepository,
      tokenService,
      cacheService,
      securityLogRepository,
      pushDevices,
      logger,
    };
  }

  it("현재 토큰을 회전하고 새 만료 시간을 저장하여 세션 캐시를 비우고 기본 요청 정보를 기록한다", async () => {
    // Given
    const fixture = given([sessionWith({ expiresAt: AUTH_FIXTURE_NOW })]);

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
    expect(fixture.sessionRepository.stored(sessionId)).toEqual(
      expect.objectContaining({
        refreshTokenHash: `digest:${result.tokens.refreshToken}`,
        previousTokenHash: `digest:${refreshToken}`,
        tokenVersion: 2,
        expiresAt: AUTH_FIXTURE_NOW.add({
          seconds: fixture.tokenService.refreshTokenExpiresInSeconds,
        }),
        lastUsedAt: AUTH_FIXTURE_NOW,
        revokedAt: null,
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
    const logs = JSON.stringify(fixture.logger.messages);
    expect(logs).not.toContain(refreshToken);
    expect(logs).not.toContain(result.tokens.accessToken);
  });

  it.each([5_000, 10_000])(
    "로테이션 후 %i ms의 이전 토큰은 네트워크 재시도로 한 번 회전한다",
    async (elapsedMilliseconds) => {
      // Given
      const fixture = given([
        sessionWith({
          refreshTokenHash: "digest:current-token",
          previousTokenHash: `digest:${refreshToken}`,
          tokenVersion: 2,
          lastUsedAt: AUTH_FIXTURE_NOW.subtract({ milliseconds: elapsedMilliseconds }),
        }),
      ]);
      const metadata = { ip: "192.0.2.1", userAgent: "Aido-Test/1.0" };

      // When
      const result = await fixture.useCase.execute({ refreshToken, verifiedPayload, metadata });

      // Then
      expect(result.tokens.refreshToken).toBe(`refresh:${sessionId}:3`);
      expect(fixture.sessionRepository.stored(sessionId)).toEqual(
        expect.objectContaining({
          refreshTokenHash: `digest:${result.tokens.refreshToken}`,
          previousTokenHash: "digest:current-token",
          tokenVersion: 3,
          revokedAt: null,
        }),
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
    const fixture = given();
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
    expect(fixture.sessionRepository.stored(sessionId)?.tokenVersion).toBe(3);
    expect(fixture.sessionRepository.stored(sessionId)?.revokedAt).toBeNull();
    expect(fixture.tokenService.issued).toHaveLength(2);
    expect(fixture.securityLogRepository.entries).toHaveLength(2);
    expect(fixture.sessionRepository.revocationReasons.size).toBe(0);
  });

  it("10초를 초과한 이전 토큰은 패밀리를 폐기하고 영향을 받은 모든 세션의 캐시를 비운다", async () => {
    // Given
    const fixture = given([
      sessionWith({
        refreshTokenHash: "digest:current-token",
        previousTokenHash: `digest:${refreshToken}`,
        lastUsedAt: AUTH_FIXTURE_NOW.subtract({ milliseconds: 10_001 }),
      }),
      createAuthSessionFixture({
        id: "family-peer",
        tokenFamily: "family-id",
        refreshTokenHash: "digest:peer-token",
      }),
      createAuthSessionFixture({
        id: "other-family",
        tokenFamily: "other-family-id",
        refreshTokenHash: "digest:other-family-token",
      }),
    ]);

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
    expect(fixture.sessionRepository.stored("family-peer")?.revokedAt).toEqual(AUTH_FIXTURE_NOW);
    expect(fixture.sessionRepository.stored("other-family")?.revokedAt).toBeNull();
    expect(fixture.cacheService.sessionIds).toEqual(new Set(["other-family"]));
    expect(fixture.pushDevices.releasedSessionIds).toEqual([sessionId, "family-peer"]);
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
    expect(fixture.alert.alerts).toEqual([
      { ...AuthAlerts.REFRESH_TOKEN_REUSED, details: { revokedCount: 2 } },
    ]);
  });

  it.each([
    {
      description: "폐기된",
      revokedAt: AUTH_FIXTURE_NOW,
      expiresAt: AUTH_FIXTURE_NOW.add({ seconds: 60 }),
      errorCode: ErrorCode.SESSION_0703,
      details: { sessionId: undefined, reason: undefined },
    },
    {
      description: "만료된",
      revokedAt: null,
      expiresAt: AUTH_FIXTURE_NOW.subtract({ milliseconds: 1 }),
      errorCode: ErrorCode.SESSION_0702,
      details: { sessionId: undefined },
    },
  ])(
    "$description 세션은 토큰·캐시·보안 기록을 변경하지 않고 기존 오류를 반환한다",
    async ({ revokedAt, expiresAt, errorCode, details }) => {
      // Given
      const fixture = given([sessionWith({ revokedAt, expiresAt })]);

      // When
      const pending = fixture.useCase.execute({ refreshToken, verifiedPayload });

      // Then
      await expect(pending).rejects.toMatchObject({ errorCode, details });
      expect(fixture.tokenService.issued).toEqual([]);
      expect(fixture.cacheService.sessionIds.has(sessionId)).toBe(true);
      expect(fixture.securityLogRepository.entries).toEqual([]);
      expect(fixture.sessionRepository.stored(sessionId)?.tokenVersion).toBe(1);
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
        previousTokenHash: `digest:${refreshToken}`,
      },
    },
  ])("$description가 검증된 페이로드와 다르면 발급하지 않는다", async ({ overrides }) => {
    // Given
    const fixture = given([sessionWith(overrides)]);

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

  it.each([
    { scenario: "세션 ID 누락", sessionIdInPayload: "", sessions: [sessionWith()] },
    { scenario: "세션 없음", sessionIdInPayload: sessionId, sessions: [] },
    {
      scenario: "이전 토큰 불일치",
      sessionIdInPayload: sessionId,
      sessions: [sessionWith({ refreshTokenHash: "digest:current-token" })],
    },
  ])(
    "$scenario이면 기존 세션을 폐기하지 않고 인증을 거부한다",
    async ({ sessionIdInPayload, sessions }) => {
      // Given
      const fixture = given(sessions);

      // When
      const pending = fixture.useCase.execute({
        refreshToken,
        verifiedPayload: { ...verifiedPayload, sessionId: sessionIdInPayload },
      });

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

  it("조건부 회전 쓰기가 경합에 지면 발급 결과를 반환하거나 앞선 회전을 덮어쓰지 않는다", async () => {
    // Given
    const sessions = [sessionWith()];
    const fixture = given(sessions, new RotationRaceSessionRepository(sessions));

    // When
    const pending = fixture.useCase.execute({ refreshToken, verifiedPayload });

    // Then
    await expect(pending).rejects.toMatchObject({
      errorCode: ErrorCode.SESSION_0702,
      details: { sessionId: undefined },
    });
    expect(fixture.sessionRepository.stored(sessionId)).toEqual(
      expect.objectContaining({
        refreshTokenHash: "digest:winner-token",
        tokenVersion: 2,
        revokedAt: null,
      }),
    );
    expect(fixture.cacheService.sessionIds.has(sessionId)).toBe(true);
    expect(fixture.securityLogRepository.entries).toEqual([]);
    expect(fixture.logger.messages).toEqual([
      { event: AuthLogEvent.SESSION_ROTATION_CONFLICT, userId, sessionId },
    ]);
  });
});
