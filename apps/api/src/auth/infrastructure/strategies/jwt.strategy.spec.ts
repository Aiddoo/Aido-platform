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

import { ErrorCode } from "@aido/errors";
import type { Mocked } from "@suites/doubles.jest";
import { TestBed } from "@suites/unit";
import { asDep, asMock } from "@test/mocks";
import { SessionService } from "@/auth/application/services/session.service";
import type { JwtPayload } from "@/auth/infrastructure/adapters/token.service";
import { SessionRepository } from "@/auth/infrastructure/persistence/session.repository";
import { UserRepository } from "@/auth/infrastructure/persistence/user.repository";
import { ApplicationException } from "@/shared/domain/exceptions/application.exception";
import { CacheService } from "@/shared/infrastructure/cache/cache.service";
import { TypedConfigService } from "@/shared/infrastructure/config/services/config.service";
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

		asMock(userRepo.findById).mockResolvedValue({
			status: "ACTIVE",
			deletedAt: null,
		});
	});

	it("refresh 타입 토큰이면 에러를 던진다", async () => {
		// Given
		const payload = { ...validPayload, type: "refresh" as const };

		// When & Then
		await expect(strategy.validate(payload)).rejects.toThrow(
			ApplicationException,
		);
	});

	it("sessionId가 없으면 에러를 던진다", async () => {
		// Given
		const payload = asDep<JwtPayload>({
			...validPayload,
			sessionId: undefined,
		});

		// When & Then
		await expect(strategy.validate(payload)).rejects.toThrow(
			ApplicationException,
		);
	});

	it("캐시 히트 시 DB 조회 없이 사용자 정보를 반환한다", async () => {
		// Given
		const futureDate = new Date(Date.now() + 86400000);
		asMock(cacheService.getSession).mockResolvedValue({
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
		asMock(cacheService.getSession).mockResolvedValue({
			userId: "user-123",
			expiresAt: new Date(Date.now() + 86400000),
			revokedAt: new Date(),
		});
		sessionService.assertSessionValid.mockImplementation(() => {
			throw new ApplicationException(ErrorCode.SESSION_0703, {
				sessionId: undefined,
				reason: undefined,
			});
		});

		// When & Then
		await expect(strategy.validate(validPayload)).rejects.toThrow(
			ApplicationException,
		);
	});

	it("캐시된 세션이 만료 상태면 에러를 던진다", async () => {
		// Given
		asMock(cacheService.getSession).mockResolvedValue({
			userId: "user-123",
			expiresAt: new Date(Date.now() - 1000),
			revokedAt: null,
		});
		sessionService.assertSessionValid.mockImplementation(() => {
			throw new ApplicationException(ErrorCode.SESSION_0702, {
				sessionId: undefined,
			});
		});

		// When & Then
		await expect(strategy.validate(validPayload)).rejects.toThrow(
			ApplicationException,
		);
	});

	it("캐시 미스 시 DB에서 세션을 조회하고 캐시에 저장한다", async () => {
		// Given
		asMock(cacheService.getSession).mockResolvedValue(null);
		const futureDate = new Date(Date.now() + 86400000);
		asMock(sessionRepo.findById).mockResolvedValue({
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
		asMock(cacheService.getSession).mockResolvedValue(null);
		asMock(sessionRepo.findById).mockResolvedValue(null);
		sessionService.assertSessionValid.mockImplementation(() => {
			throw new ApplicationException(ErrorCode.SESSION_0701, {
				sessionId: undefined,
			});
		});

		// When & Then
		await expect(strategy.validate(validPayload)).rejects.toThrow(
			ApplicationException,
		);
	});

	it("DB에서 조회한 세션이 폐기 상태면 에러를 던진다", async () => {
		// Given
		asMock(cacheService.getSession).mockResolvedValue(null);
		asMock(sessionRepo.findById).mockResolvedValue({
			id: "session-456",
			userId: "user-123",
			expiresAt: new Date(Date.now() + 86400000),
			revokedAt: new Date(),
		});
		sessionService.assertSessionValid.mockImplementation(() => {
			throw new ApplicationException(ErrorCode.SESSION_0703, {
				sessionId: undefined,
				reason: undefined,
			});
		});

		// When & Then
		await expect(strategy.validate(validPayload)).rejects.toThrow(
			ApplicationException,
		);
	});

	it("DB에서 조회한 세션이 만료 상태면 에러를 던진다", async () => {
		// Given
		asMock(cacheService.getSession).mockResolvedValue(null);
		asMock(sessionRepo.findById).mockResolvedValue({
			id: "session-456",
			userId: "user-123",
			expiresAt: new Date(Date.now() - 1000),
			revokedAt: null,
		});
		sessionService.assertSessionValid.mockImplementation(() => {
			throw new ApplicationException(ErrorCode.SESSION_0702, {
				sessionId: undefined,
			});
		});

		// When & Then
		await expect(strategy.validate(validPayload)).rejects.toThrow(
			ApplicationException,
		);
	});

	describe("캐시 장애 폴백 (Redis 다운이어도 인증은 계속된다)", () => {
		const cacheFailure = new Error("Connection is closed.");
		const futureDate = new Date(Date.now() + 86400000);

		it("세션 캐시 읽기 실패 시 DB 조회로 폴백해 정상 인증한다", async () => {
			// Given
			asMock(cacheService.getSession).mockRejectedValue(cacheFailure);
			asMock(sessionRepo.findById).mockResolvedValue({
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
		});

		it("세션 캐시 쓰기 실패는 무시하고 정상 인증한다", async () => {
			// Given
			asMock(cacheService.getSession).mockResolvedValue(null);
			asMock(cacheService.setSession).mockRejectedValue(cacheFailure);
			asMock(sessionRepo.findById).mockResolvedValue({
				id: "session-456",
				userId: "user-123",
				expiresAt: futureDate,
				revokedAt: null,
			});

			// When
			const result = await strategy.validate(validPayload);

			// Then
			expect(result.userId).toBe("user-123");
		});

		it("캐시 폴백은 의도적 401(세션 무효)을 삼키지 않는다", async () => {
			// Given — 캐시는 정상, 세션이 진짜로 폐기된 상황
			asMock(cacheService.getSession).mockResolvedValue({
				userId: "user-123",
				expiresAt: futureDate,
				revokedAt: new Date(),
			});
			sessionService.assertSessionValid.mockImplementation(() => {
				throw new ApplicationException(ErrorCode.SESSION_0703, {
					sessionId: undefined,
					reason: undefined,
				});
			});

			// When & Then
			await expect(strategy.validate(validPayload)).rejects.toThrow(
				ApplicationException,
			);
		});
	});
});
