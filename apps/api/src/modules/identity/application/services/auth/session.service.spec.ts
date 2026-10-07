import { ErrorCode } from "@aido/api/errors";
import { vi } from "vitest";

import {
  StubAuthSessionRepository,
  StubAuthTokenIssuer,
} from "#test/mocks/ports/auth-session.stub";

import {
  type CreateSessionParams,
  SessionService,
  type SessionValidatable,
} from "./session.service.js";

const currentTime = new Date("2026-12-31T23:59:00.000Z");
const sessionId = "session-abc";
const input: CreateSessionParams = {
  userId: "user-123",
  email: "test@example.com",
  role: "USER",
  deviceFingerprint: "device-fp-123",
  userAgent: "Mozilla/5.0 (Test Browser)",
  ipAddress: "127.0.0.1",
};

describe("SessionService — 세션 생성과 유효성", () => {
  let service: SessionService;
  let sessionRepository: StubAuthSessionRepository;
  let tokenService: StubAuthTokenIssuer;

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(currentTime);
    sessionRepository = new StubAuthSessionRepository();
    tokenService = new StubAuthTokenIssuer();
    service = new SessionService({ sessionRepository, tokenService });
  });

  afterEach(() => vi.useRealTimers());

  describe("createSessionWithTokens", () => {
    it("저장된 세션 ID로 토큰을 발급하고 정확한 만료일과 Refresh Token 해시를 저장한다", async () => {
      // Given - 고정 시각과 빈 세션 저장소

      // When
      const result = await service.createSessionWithTokens(input);

      // Then
      expect(sessionRepository.sessions.size).toBe(1);
      expect(result).toEqual({
        sessionId: "session-1",
        tokenFamily: "token-family-1",
        tokens: {
          accessToken: "access:session-1:1",
          refreshToken: "refresh:session-1:1",
          expiresIn: 900,
        },
      });
      expect(sessionRepository.creations).toEqual([
        {
          userId: input.userId,
          tokenFamily: result.tokenFamily,
          tokenVersion: 1,
          deviceFingerprint: input.deviceFingerprint,
          userAgent: input.userAgent,
          ipAddress: input.ipAddress,
          expiresAt: new Date("2027-01-07T23:59:00.000Z"),
        },
      ]);
      expect(tokenService.issued).toEqual([
        {
          userId: input.userId,
          email: input.email,
          sessionId: result.sessionId,
          role: input.role,
          tokenFamily: result.tokenFamily,
          tokenVersion: 1,
        },
      ]);
      expect(sessionRepository.sessions.get(result.sessionId)).toEqual(
        expect.objectContaining({
          userId: input.userId,
          tokenFamily: result.tokenFamily,
          tokenVersion: 1,
          refreshTokenHash: tokenService.hashRefreshToken(result.tokens.refreshToken),
          expiresAt: new Date("2027-01-07T23:59:00.000Z"),
        }),
      );
    });

    it("세션 저장이 실패하면 토큰을 발급하지 않고 오류를 전파한다", async () => {
      // Given
      vi.spyOn(sessionRepository, "create").mockRejectedValueOnce(
        new Error("DB connection failed"),
      );

      // When
      const pending = service.createSessionWithTokens(input);

      // Then
      await expect(pending).rejects.toThrow("DB connection failed");
      expect(sessionRepository.sessions.size).toBe(0);
      expect(tokenService.issued).toEqual([]);
    });

    it("토큰 발급이 실패하면 Refresh Token 해시를 저장하지 않고 오류를 전파한다", async () => {
      // Given
      vi.spyOn(tokenService, "generateTokenPair").mockRejectedValueOnce(
        new Error("Token generation failed"),
      );

      // When
      const pending = service.createSessionWithTokens(input);

      // Then
      await expect(pending).rejects.toThrow("Token generation failed");
      expect(sessionRepository.sessions.get("session-1")?.refreshTokenHash).toBe(
        "pending:session-1",
      );
      expect(tokenService.issued).toEqual([]);
    });

    it("Refresh Token 해시 저장이 실패하면 발급 결과를 반환하지 않고 오류를 전파한다", async () => {
      // Given
      vi.spyOn(sessionRepository, "updateRefreshTokenHash").mockRejectedValueOnce(
        new Error("Update failed"),
      );

      // When
      const pending = service.createSessionWithTokens(input);

      // Then
      await expect(pending).rejects.toThrow("Update failed");
      expect(sessionRepository.sessions.get("session-1")?.refreshTokenHash).toBe(
        "pending:session-1",
      );
      expect(tokenService.issued).toHaveLength(1);
    });
  });

  describe("assertSessionValid", () => {
    it.each([null, undefined])("세션이 %s이면 기존 오류 코드와 세션 ID를 유지한다", (session) => {
      // Given - 고정된 세션 ID와 부재 상태

      // When
      const validate = () => service.assertSessionValid(session, sessionId);

      // Then
      expect(validate).toThrowError(
        expect.objectContaining({
          errorCode: ErrorCode.SESSION_0701,
          details: { sessionId },
        }),
      );
    });

    it.each(["Date", "string"])("폐기와 만료가 겹친 %s 세션은 폐기 오류를 우선한다", (format) => {
      // Given
      const revokedAt = new Date(currentTime.getTime() - 2);
      const session: SessionValidatable = {
        revokedAt: format === "Date" ? revokedAt : revokedAt.toISOString(),
        expiresAt: new Date(currentTime.getTime() - 1),
      };

      // When
      const validate = () => service.assertSessionValid(session, sessionId);

      // Then
      expect(validate).toThrowError(
        expect.objectContaining({
          errorCode: ErrorCode.SESSION_0703,
          details: { sessionId, reason: undefined },
        }),
      );
    });

    it.each(["Date", "string"])(
      "현재보다 1ms 전에 만료된 %s 세션은 만료 오류를 반환한다",
      (format) => {
        // Given
        const expiresAt = new Date(currentTime.getTime() - 1);
        const session = {
          revokedAt: null,
          expiresAt: format === "Date" ? expiresAt : expiresAt.toISOString(),
        };

        // When
        const validate = () => service.assertSessionValid(session, sessionId);

        // Then
        expect(validate).toThrowError(
          expect.objectContaining({
            errorCode: ErrorCode.SESSION_0702,
            details: { sessionId },
          }),
        );
      },
    );

    it.each(["Date", "string"])(
      "현재와 만료 시각이 같은 %s 세션은 기존 경계대로 유효하다",
      (format) => {
        // Given
        const session = {
          revokedAt: null,
          expiresAt: format === "Date" ? currentTime : currentTime.toISOString(),
        };

        // When
        const validate = () => service.assertSessionValid(session, sessionId);

        // Then
        expect(validate).not.toThrow();
      },
    );
  });
});
