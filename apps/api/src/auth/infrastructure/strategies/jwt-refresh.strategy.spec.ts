import type { Request } from "express";
import { vi } from "vitest";
/**
 * JwtRefreshStrategy 단위 테스트
 *
 * @description
 * Refresh 토큰 전략의 validate 메서드를 검증한다.
 * 토큰 타입, sessionId, Authorization 헤더 유효성을 확인한다.
 *
 * 실행 명령:
 * ```bash
 * pnpm --filter @aido/server test jwt-refresh.strategy.spec.ts
 * ```
 */

import type { JwtPayload } from "#api/auth/infrastructure/adapters/token.service";
import { ApplicationException } from "#api/shared/domain/exceptions/application.exception";
import { TypedConfigService } from "#api/shared/infrastructure/config/services/config.service";
import { asDep, mockOf } from "#test/mocks/index";

import { JwtRefreshStrategy } from "./jwt-refresh.strategy.js";

describe("JwtRefreshStrategy — JWT 리프레시 전략", () => {
  let strategy: JwtRefreshStrategy;

  const validPayload: JwtPayload = {
    sub: "user-123",
    email: "test@example.com",
    sessionId: "session-456",
    role: "USER",
    type: "refresh",
  };

  const createMockRequest = (authHeader?: string): Request =>
    mockOf<Request>({
      headers: {
        authorization: authHeader,
      },
    });

  beforeEach(() => {
    // JwtRefreshStrategy는 configService.get('JWT_REFRESH_SECRET')만 필요
    const mockConfigService = {
      get: vi.fn().mockReturnValue("test-refresh-secret-key"),
    };
    strategy = new JwtRefreshStrategy(asDep<TypedConfigService>(mockConfigService));
  });

  it("유효한 refresh 페이로드면 RefreshTokenPayload를 반환한다", async () => {
    // Given
    const req = createMockRequest("Bearer valid-refresh-token");

    // When
    const result = await strategy.validate(req, validPayload);

    // Then
    expect(result).toEqual({
      userId: "user-123",
      email: "test@example.com",
      sessionId: "session-456",
      role: "USER",
      refreshToken: "valid-refresh-token",
    });
  });

  it("access 타입 토큰이면 에러를 던진다", async () => {
    // Given
    const req = createMockRequest("Bearer some-token");
    const payload = { ...validPayload, type: "access" as const };

    // When & Then
    await expect(strategy.validate(req, payload)).rejects.toThrow(ApplicationException);
  });

  it("sessionId가 없으면 에러를 던진다", async () => {
    // Given
    const req = createMockRequest("Bearer some-token");
    const payload = asDep<JwtPayload>({
      ...validPayload,
      sessionId: undefined,
    });

    // When & Then
    await expect(strategy.validate(req, payload)).rejects.toThrow(ApplicationException);
  });

  it("Authorization 헤더가 없으면 에러를 던진다", async () => {
    // Given
    const req = createMockRequest(undefined);

    // When & Then
    await expect(strategy.validate(req, validPayload)).rejects.toThrow(ApplicationException);
  });
});
