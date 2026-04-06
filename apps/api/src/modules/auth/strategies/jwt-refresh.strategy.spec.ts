/**
 * JwtRefreshStrategy 단위 테스트
 *
 * @description
 * Refresh 토큰 전략의 validate 메서드를 검증한다.
 * 토큰 타입, sessionId, Authorization 헤더 유효성을 확인한다.
 *
 * 실행 명령:
 * ```bash
 * pnpm --filter @aido/api test jwt-refresh.strategy.spec.ts
 * ```
 */

import type { Request } from "express";
import { BusinessException } from "@/common/exception/services/business-exception.service";
import type { JwtPayload } from "../services/token.service";
import { JwtRefreshStrategy } from "./jwt-refresh.strategy";

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
		({
			headers: {
				authorization: authHeader,
			},
		}) as unknown as Request;

	beforeEach(() => {
		// JwtRefreshStrategy는 configService.get('JWT_REFRESH_SECRET')만 필요
		const mockConfigService = {
			get: jest.fn().mockReturnValue("test-refresh-secret-key"),
		};
		strategy = new JwtRefreshStrategy(mockConfigService as any);
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
			refreshToken: "valid-refresh-token",
		});
	});

	it("access 타입 토큰이면 에러를 던진다", async () => {
		// Given
		const req = createMockRequest("Bearer some-token");
		const payload = { ...validPayload, type: "access" as const };

		// When & Then
		await expect(strategy.validate(req, payload)).rejects.toThrow(
			BusinessException,
		);
	});

	it("sessionId가 없으면 에러를 던진다", async () => {
		// Given
		const req = createMockRequest("Bearer some-token");
		const payload = { ...validPayload, sessionId: undefined } as JwtPayload;

		// When & Then
		await expect(strategy.validate(req, payload)).rejects.toThrow(
			BusinessException,
		);
	});

	it("Authorization 헤더가 없으면 에러를 던진다", async () => {
		// Given
		const req = createMockRequest(undefined);

		// When & Then
		await expect(strategy.validate(req, validPayload)).rejects.toThrow(
			BusinessException,
		);
	});
});
