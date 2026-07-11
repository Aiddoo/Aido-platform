/**
 * SessionService 단위 테스트
 *
 * Suites + GWT 패턴 적용
 * - Suites: TestBed.solitary()로 자동 Mock 생성
 * - GWT: Given/When/Then 주석으로 테스트 구조화
 *
 * @see https://docs.nestjs.com/recipes/suites
 */
import type { Mocked } from "@suites/doubles.jest";
import { TestBed } from "@suites/unit";
import { SessionBuilder } from "@test/builders";
import type { TokenPair } from "@/auth/infrastructure/adapters/token.service";
import { TokenService } from "@/auth/infrastructure/adapters/token.service";

import { SessionRepository } from "@/auth/infrastructure/persistence/session.repository";
import type { Session } from "@/generated/prisma/client";
import { BusinessException } from "@/shared/application/exceptions/business-exception.service";
import {
	type CreateSessionParams,
	type CreateSessionResult,
	SessionService,
	type SessionValidatable,
} from "./session.service";

describe("SessionService — 세션 서비스", () => {
	let service: SessionService;
	let sessionRepo: Mocked<SessionRepository>;
	let tokenService: Mocked<TokenService>;

	// 재사용 가능한 테스트 데이터
	const mockUserId = "user-123";
	const mockEmail = "test@example.com";
	const mockSessionId = "session-abc";
	const mockTokenFamily = "token-family-hex";
	const mockRefreshTokenHash = "hashed-refresh-token";
	const mockRefreshExpiresInSeconds = 604800; // 7일

	const mockTokens: TokenPair = {
		accessToken: "access-token",
		refreshToken: "refresh-token",
		expiresIn: 900,
	};

	const mockParams: CreateSessionParams = {
		userId: mockUserId,
		email: mockEmail,
		role: "USER",
		deviceFingerprint: "device-fp-123",
		userAgent: "Mozilla/5.0 (Test Browser)",
		ipAddress: "127.0.0.1",
	};

	beforeEach(async () => {
		// Suites가 모든 의존성을 자동으로 mock
		const { unit, unitRef } = await TestBed.solitary(SessionService).compile();

		service = unit;
		sessionRepo = unitRef.get(SessionRepository);
		tokenService = unitRef.get(TokenService);
	});

	describe("createSessionWithTokens", () => {
		/**
		 * createSessionWithTokens 성공 시나리오 mock 설정 헬퍼
		 */
		const setupCreateSessionSuccess = (session: Session) => {
			tokenService.generateTokenFamily.mockReturnValue(mockTokenFamily);
			tokenService.getRefreshTokenExpiresInSeconds.mockReturnValue(
				mockRefreshExpiresInSeconds,
			);
			sessionRepo.create.mockResolvedValue(session);
			tokenService.generateTokenPair.mockResolvedValue(mockTokens);
			tokenService.hashRefreshToken.mockReturnValue(mockRefreshTokenHash);
			sessionRepo.updateRefreshTokenHash.mockResolvedValue({
				...session,
				refreshTokenHash: mockRefreshTokenHash,
			});
		};

		it("세션 생성 + 토큰 발급 + refreshTokenHash 업데이트를 순서대로 수행한다", async () => {
			// Given
			const mockSession = SessionBuilder.create(mockUserId)
				.withId(mockSessionId)
				.withTokenFamily(mockTokenFamily)
				.build();
			setupCreateSessionSuccess(mockSession);

			// When
			const result = await service.createSessionWithTokens(mockParams);

			// Then
			expect(result).toEqual<CreateSessionResult>({
				sessionId: mockSessionId,
				tokens: mockTokens,
				tokenFamily: mockTokenFamily,
			});
		});

		it("tokenFamily를 생성하여 세션에 전달한다", async () => {
			// Given
			const mockSession = SessionBuilder.create(mockUserId)
				.withId(mockSessionId)
				.withTokenFamily(mockTokenFamily)
				.build();
			setupCreateSessionSuccess(mockSession);

			// When
			await service.createSessionWithTokens(mockParams);

			// Then
			expect(tokenService.generateTokenFamily).toHaveBeenCalledTimes(1);
			expect(sessionRepo.create).toHaveBeenCalledWith(
				expect.objectContaining({
					userId: mockUserId,
					tokenFamily: mockTokenFamily,
					tokenVersion: 1,
					deviceFingerprint: mockParams.deviceFingerprint,
					userAgent: mockParams.userAgent,
					ipAddress: mockParams.ipAddress,
				}),
				undefined, // tx 없이 호출
			);
		});

		it("refreshTokenExpiresInSeconds 기반으로 expiresAt을 계산한다", async () => {
			// Given
			const mockSession = SessionBuilder.create(mockUserId)
				.withId(mockSessionId)
				.build();
			setupCreateSessionSuccess(mockSession);

			// When
			await service.createSessionWithTokens(mockParams);

			// Then
			expect(
				tokenService.getRefreshTokenExpiresInSeconds,
			).toHaveBeenCalledTimes(1);
			expect(sessionRepo.create).toHaveBeenCalledWith(
				expect.objectContaining({
					expiresAt: expect.any(Date),
				}),
				undefined,
			);
		});

		it("생성된 세션 ID로 토큰 쌍을 발급한다", async () => {
			// Given
			const mockSession = SessionBuilder.create(mockUserId)
				.withId(mockSessionId)
				.withTokenFamily(mockTokenFamily)
				.build();
			setupCreateSessionSuccess(mockSession);

			// When
			await service.createSessionWithTokens(mockParams);

			// Then
			expect(tokenService.generateTokenPair).toHaveBeenCalledWith(
				mockUserId,
				mockEmail,
				mockSessionId,
				"USER",
				mockTokenFamily,
				1,
			);
		});

		it("refreshToken을 해싱하여 세션에 업데이트한다", async () => {
			// Given
			const mockSession = SessionBuilder.create(mockUserId)
				.withId(mockSessionId)
				.build();
			setupCreateSessionSuccess(mockSession);

			// When
			await service.createSessionWithTokens(mockParams);

			// Then
			expect(tokenService.hashRefreshToken).toHaveBeenCalledWith(
				mockTokens.refreshToken,
			);
			expect(sessionRepo.updateRefreshTokenHash).toHaveBeenCalledWith(
				mockSessionId,
				mockRefreshTokenHash,
				undefined, // tx 없이 호출
			);
		});

		it("트랜잭션 클라이언트가 전달되면 Repository 호출에 tx를 전달한다", async () => {
			// Given
			const mockSession = SessionBuilder.create(mockUserId)
				.withId(mockSessionId)
				.build();
			setupCreateSessionSuccess(mockSession);

			const mockTx = {} as never; // 트랜잭션 mock

			// When
			await service.createSessionWithTokens(mockParams, mockTx);

			// Then
			expect(sessionRepo.create).toHaveBeenCalledWith(
				expect.any(Object),
				mockTx,
			);
			expect(sessionRepo.updateRefreshTokenHash).toHaveBeenCalledWith(
				mockSessionId,
				mockRefreshTokenHash,
				mockTx,
			);
		});

		it("세션 생성 실패 시 에러가 전파된다", async () => {
			// Given
			tokenService.generateTokenFamily.mockReturnValue(mockTokenFamily);
			tokenService.getRefreshTokenExpiresInSeconds.mockReturnValue(
				mockRefreshExpiresInSeconds,
			);
			sessionRepo.create.mockRejectedValue(new Error("DB connection failed"));

			// When & Then
			await expect(service.createSessionWithTokens(mockParams)).rejects.toThrow(
				"DB connection failed",
			);
		});

		it("토큰 발급 실패 시 에러가 전파된다", async () => {
			// Given
			const mockSession = SessionBuilder.create(mockUserId)
				.withId(mockSessionId)
				.build();
			tokenService.generateTokenFamily.mockReturnValue(mockTokenFamily);
			tokenService.getRefreshTokenExpiresInSeconds.mockReturnValue(
				mockRefreshExpiresInSeconds,
			);
			sessionRepo.create.mockResolvedValue(mockSession);
			tokenService.generateTokenPair.mockRejectedValue(
				new Error("Token generation failed"),
			);

			// When & Then
			await expect(service.createSessionWithTokens(mockParams)).rejects.toThrow(
				"Token generation failed",
			);
		});

		it("refreshTokenHash 업데이트 실패 시 에러가 전파된다", async () => {
			// Given
			const mockSession = SessionBuilder.create(mockUserId)
				.withId(mockSessionId)
				.build();
			tokenService.generateTokenFamily.mockReturnValue(mockTokenFamily);
			tokenService.getRefreshTokenExpiresInSeconds.mockReturnValue(
				mockRefreshExpiresInSeconds,
			);
			sessionRepo.create.mockResolvedValue(mockSession);
			tokenService.generateTokenPair.mockResolvedValue(mockTokens);
			tokenService.hashRefreshToken.mockReturnValue(mockRefreshTokenHash);
			sessionRepo.updateRefreshTokenHash.mockRejectedValue(
				new Error("Update failed"),
			);

			// When & Then
			await expect(service.createSessionWithTokens(mockParams)).rejects.toThrow(
				"Update failed",
			);
		});
	});

	describe("assertSessionValid", () => {
		it("세션이 null이면 sessionNotFound를 던진다", () => {
			// Given
			const session = null;

			// When & Then
			expect(() => service.assertSessionValid(session)).toThrow(
				BusinessException,
			);
		});

		it("세션이 undefined이면 sessionNotFound를 던진다", () => {
			// Given
			const session = undefined;

			// When & Then
			expect(() => service.assertSessionValid(session)).toThrow(
				BusinessException,
			);
		});

		it("세션이 폐기(revokedAt)되었으면 sessionRevoked를 던진다", () => {
			// Given
			const session: SessionValidatable = {
				revokedAt: new Date(),
				expiresAt: new Date(Date.now() + 86400000),
			};

			// When & Then
			expect(() => service.assertSessionValid(session)).toThrow(
				BusinessException,
			);
		});

		it("세션이 만료(expiresAt < now)되었으면 sessionExpired를 던진다", () => {
			// Given
			const session: SessionValidatable = {
				revokedAt: null,
				expiresAt: new Date(Date.now() - 1000),
			};

			// When & Then
			expect(() => service.assertSessionValid(session)).toThrow(
				BusinessException,
			);
		});

		it("유효한 세션이면 에러를 던지지 않는다", () => {
			// Given
			const session: SessionValidatable = {
				revokedAt: null,
				expiresAt: new Date(Date.now() + 86400000),
			};

			// When & Then
			expect(() => service.assertSessionValid(session)).not.toThrow();
		});

		it("CachedSession (string expiresAt)도 정상 처리한다", () => {
			// Given
			const futureDate = new Date(Date.now() + 86400000);
			const session: SessionValidatable = {
				revokedAt: null,
				expiresAt: futureDate.toISOString(),
			};

			// When & Then
			expect(() => service.assertSessionValid(session)).not.toThrow();
		});

		it("sessionId를 전달하면 에러 메시지에 포함된다", () => {
			// Given
			const session = null;
			const sessionId = "test-session-id";

			// When & Then
			expect(() => service.assertSessionValid(session, sessionId)).toThrow(
				BusinessException,
			);
		});
	});
});
