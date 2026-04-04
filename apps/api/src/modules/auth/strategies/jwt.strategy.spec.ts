/**
 * JwtStrategy 단위 테스트
 *
 * @description
 * Access 토큰 전략의 validate 메서드를 검증한다.
 * 캐시 히트/미스, 세션 상태(폐기/만료), DB 조회 흐름을 확인한다.
 *
 * 실행 명령:
 * ```bash
 * pnpm --filter @aido/api test jwt.strategy.spec.ts
 * ```
 */

import type { Mocked } from "@suites/doubles.jest";
import { TestBed } from "@suites/unit";
import { CacheService } from "@/common/cache/cache.service";
import { TypedConfigService } from "@/common/config/services/config.service";
import {
	BusinessException,
	BusinessExceptions,
} from "@/common/exception/services/business-exception.service";
import { SessionRepository } from "../repositories/session.repository";
import { UserRepository } from "../repositories/user.repository";
import { SessionService } from "../services/session.service";
import type { JwtPayload } from "../services/token.service";
import { JwtStrategy } from "./jwt.strategy";

describe("JwtStrategy — JWT 전략", () => {
	let strategy: JwtStrategy;
	let sessionRepo: Mocked<SessionRepository>;
	let sessionService: Mocked<SessionService>;
	let cacheService: Mocked<CacheService>;
	let userRepo: Mocked<UserRepository>;

	const validPayload: JwtPayload = {
		sub: "user-123",
		email: "test@example.com",
		sessionId: "session-456",
		role: "USER",
		type: "access",
	};

	beforeEach(async () => {
		const { unit, unitRef } = await TestBed.solitary(JwtStrategy)
			.mock(TypedConfigService)
			.impl((mock) => ({
				...mock,
				get: jest.fn().mockReturnValue("test-jwt-secret-key"),
			}))
			.compile();

		strategy = unit;
		sessionRepo = unitRef.get(SessionRepository);
		sessionService = unitRef.get(SessionService);
		cacheService = unitRef.get(CacheService);
		userRepo = unitRef.get(UserRepository);

		userRepo.findById.mockResolvedValue({
			status: "ACTIVE",
			deletedAt: null,
		} as never);
	});

	it("refresh 타입 토큰이면 에러를 던진다", async () => {
		// Given
		const payload = { ...validPayload, type: "refresh" as const };

		// When & Then
		await expect(strategy.validate(payload)).rejects.toThrow(BusinessException);
	});

	it("sessionId가 없으면 에러를 던진다", async () => {
		// Given
		const payload = { ...validPayload, sessionId: undefined } as JwtPayload;

		// When & Then
		await expect(strategy.validate(payload)).rejects.toThrow(BusinessException);
	});

	it("캐시 히트 시 DB 조회 없이 사용자 정보를 반환한다", async () => {
		// Given
		const futureDate = new Date(Date.now() + 86400000);
		(cacheService.getSession as jest.Mock).mockResolvedValue({
			userId: "user-123",
			expiresAt: futureDate,
			revokedAt: null,
		});

		// When
		const result = await strategy.validate(validPayload);

		// Then
		expect(result).toEqual({
			userId: "user-123",
			email: "test@example.com",
			sessionId: "session-456",
			role: "USER",
		});
		expect(sessionRepo.findById).not.toHaveBeenCalled();
	});

	it("캐시된 세션이 폐기 상태면 에러를 던진다", async () => {
		// Given
		(cacheService.getSession as jest.Mock).mockResolvedValue({
			userId: "user-123",
			expiresAt: new Date(Date.now() + 86400000),
			revokedAt: new Date(),
		});
		sessionService.assertSessionValid.mockImplementation(() => {
			throw BusinessExceptions.sessionRevoked();
		});

		// When & Then
		await expect(strategy.validate(validPayload)).rejects.toThrow(
			BusinessException,
		);
	});

	it("캐시된 세션이 만료 상태면 에러를 던진다", async () => {
		// Given
		(cacheService.getSession as jest.Mock).mockResolvedValue({
			userId: "user-123",
			expiresAt: new Date(Date.now() - 1000),
			revokedAt: null,
		});
		sessionService.assertSessionValid.mockImplementation(() => {
			throw BusinessExceptions.sessionExpired();
		});

		// When & Then
		await expect(strategy.validate(validPayload)).rejects.toThrow(
			BusinessException,
		);
	});

	it("캐시 미스 시 DB에서 세션을 조회하고 캐시에 저장한다", async () => {
		// Given
		(cacheService.getSession as jest.Mock).mockResolvedValue(null);
		const futureDate = new Date(Date.now() + 86400000);
		(sessionRepo.findById as jest.Mock).mockResolvedValue({
			id: "session-456",
			userId: "user-123",
			expiresAt: futureDate,
			revokedAt: null,
		});

		// When
		const result = await strategy.validate(validPayload);

		// Then
		expect(result.userId).toBe("user-123");
		expect(sessionRepo.findById).toHaveBeenCalledWith("session-456");
		expect(cacheService.setSession).toHaveBeenCalledWith("session-456", {
			userId: "user-123",
			expiresAt: futureDate,
			revokedAt: null,
			userStatus: "ACTIVE",
			userDeletedAt: null,
		});
	});

	it("DB에서 세션을 찾을 수 없으면 에러를 던진다", async () => {
		// Given
		(cacheService.getSession as jest.Mock).mockResolvedValue(null);
		(sessionRepo.findById as jest.Mock).mockResolvedValue(null);
		sessionService.assertSessionValid.mockImplementation(() => {
			throw BusinessExceptions.sessionNotFound();
		});

		// When & Then
		await expect(strategy.validate(validPayload)).rejects.toThrow(
			BusinessException,
		);
	});

	it("DB에서 조회한 세션이 폐기 상태면 에러를 던진다", async () => {
		// Given
		(cacheService.getSession as jest.Mock).mockResolvedValue(null);
		(sessionRepo.findById as jest.Mock).mockResolvedValue({
			id: "session-456",
			userId: "user-123",
			expiresAt: new Date(Date.now() + 86400000),
			revokedAt: new Date(),
		});
		sessionService.assertSessionValid.mockImplementation(() => {
			throw BusinessExceptions.sessionRevoked();
		});

		// When & Then
		await expect(strategy.validate(validPayload)).rejects.toThrow(
			BusinessException,
		);
	});

	it("DB에서 조회한 세션이 만료 상태면 에러를 던진다", async () => {
		// Given
		(cacheService.getSession as jest.Mock).mockResolvedValue(null);
		(sessionRepo.findById as jest.Mock).mockResolvedValue({
			id: "session-456",
			userId: "user-123",
			expiresAt: new Date(Date.now() - 1000),
			revokedAt: null,
		});
		sessionService.assertSessionValid.mockImplementation(() => {
			throw BusinessExceptions.sessionExpired();
		});

		// When & Then
		await expect(strategy.validate(validPayload)).rejects.toThrow(
			BusinessException,
		);
	});
});
