import { LOGIN_ATTEMPT } from "@aido/validators";
import { Test, type TestingModule } from "@nestjs/testing";
import { CacheService } from "@/common/cache/cache.service";
import { BusinessException } from "@/common/exception/services/business-exception.service";
import { DatabaseService } from "@/database";
import type { Session, User } from "@/generated/prisma/client";
import { REVOKE_REASON, SECURITY_EVENT } from "../constants/auth.constants";
import { AccountRepository } from "../repositories/account.repository";
import { LoginAttemptRepository } from "../repositories/login-attempt.repository";
import { SecurityLogRepository } from "../repositories/security-log.repository";
import { SessionRepository } from "../repositories/session.repository";
import { UserRepository } from "../repositories/user.repository";
import { AuthService } from "./auth.service";
import { PasswordService } from "./password.service";
import { TokenService } from "./token.service";
import { VerificationService } from "./verification.service";

describe("AuthService", () => {
	let service: AuthService;

	// Mock 객체들
	const mockDatabase = {
		$transaction: jest.fn((callback) => callback({})),
	};

	const mockUserRepository = {
		findByEmail: jest.fn(),
		findById: jest.fn(),
		findByIdWithProfile: jest.fn(),
		findByEmailWithCredential: jest.fn(),
		existsByEmail: jest.fn(),
		create: jest.fn(),
		createProfile: jest.fn(),
		markEmailVerified: jest.fn(),
		updateLastLoginAt: jest.fn(),
		updateStatus: jest.fn(),
		updateProfile: jest.fn(),
	};

	const mockAccountRepository = {
		findByUserIdAndProvider: jest.fn(),
		createCredentialAccount: jest.fn(),
		updatePassword: jest.fn(),
	};

	const mockSessionRepository = {
		create: jest.fn(),
		findById: jest.fn(),
		findByRefreshTokenHash: jest.fn(),
		findByPreviousTokenHash: jest.fn(),
		findActiveByUserId: jest.fn(),
		updateRefreshTokenHash: jest.fn(),
		revoke: jest.fn(),
		revokeAllByUserId: jest.fn(),
		revokeByTokenFamily: jest.fn(),
		rotateToken: jest.fn(),
	};

	const mockLoginAttemptRepository = {
		create: jest.fn(),
		countRecentFailuresByEmail: jest.fn(),
	};

	const mockSecurityLogRepository = {
		create: jest.fn(),
	};

	const mockPasswordService = {
		hash: jest.fn(),
		verify: jest.fn(),
	};

	const mockTokenService = {
		generateTokenPair: jest.fn(),
		generateTokenFamily: jest.fn(),
		hashRefreshToken: jest.fn(),
		verifyRefreshToken: jest.fn(),
		getRefreshTokenExpiresInSeconds: jest.fn(),
	};

	const mockVerificationService = {
		createAndSendEmailVerification: jest.fn(),
		createAndSendPasswordReset: jest.fn(),
		verifyCode: jest.fn(),
		createEmailVerification: jest.fn(),
		sendVerificationEmail: jest.fn(),
	};

	const mockCacheService = {
		get: jest.fn(),
		set: jest.fn(),
		del: jest.fn(),
		delByPattern: jest.fn(),
		reset: jest.fn(),
		getStats: jest.fn(),
		getSession: jest.fn(),
		setSession: jest.fn(),
		invalidateSession: jest.fn(),
		getUserProfile: jest.fn(),
		setUserProfile: jest.fn(),
		invalidateUserProfile: jest.fn(),
		wrapUserProfile: jest.fn(),
		getSubscription: jest.fn(),
		setSubscription: jest.fn(),
		invalidateSubscription: jest.fn(),
		getMutualFriend: jest.fn(),
		setMutualFriend: jest.fn(),
		invalidateFriendRelations: jest.fn(),
		getDailyStats: jest.fn(),
		setDailyStats: jest.fn(),
		invalidateDailyStats: jest.fn(),
	};

	beforeEach(async () => {
		jest.clearAllMocks();

		const module: TestingModule = await Test.createTestingModule({
			providers: [
				AuthService,
				{ provide: DatabaseService, useValue: mockDatabase },
				{ provide: UserRepository, useValue: mockUserRepository },
				{ provide: AccountRepository, useValue: mockAccountRepository },
				{ provide: SessionRepository, useValue: mockSessionRepository },
				{
					provide: LoginAttemptRepository,
					useValue: mockLoginAttemptRepository,
				},
				{ provide: SecurityLogRepository, useValue: mockSecurityLogRepository },
				{ provide: PasswordService, useValue: mockPasswordService },
				{ provide: TokenService, useValue: mockTokenService },
				{ provide: VerificationService, useValue: mockVerificationService },
				{ provide: CacheService, useValue: mockCacheService },
			],
		}).compile();

		service = module.get<AuthService>(AuthService);
	});

	// ============================================
	// register
	// ============================================

	describe("register", () => {
		const registerInput = {
			email: "test@example.com",
			password: "Password123!",
			passwordConfirm: "Password123!",
			termsAgreed: true,
			privacyAgreed: true,
			marketingAgreed: false,
		} as const;

		const mockUser: Partial<User> = {
			id: "user-123",
			email: "test@example.com",
			status: "PENDING_VERIFY",
			emailVerifiedAt: null,
			createdAt: new Date(),
			updatedAt: new Date(),
		};

		beforeEach(() => {
			mockUserRepository.findByEmail.mockResolvedValue(null);
			mockPasswordService.hash.mockResolvedValue("hashed-password");
			mockDatabase.$transaction.mockImplementation(async (callback) => {
				const mockTx = {
					userConsent: { create: jest.fn() },
					userPreference: { create: jest.fn() },
				};
				return callback(mockTx);
			});
			mockUserRepository.create.mockResolvedValue(mockUser);
			mockAccountRepository.createCredentialAccount.mockResolvedValue({});
			// 새 아키텍처: createEmailVerification (DB 저장) + sendVerificationEmail (이메일 발송) 분리
			mockVerificationService.createEmailVerification.mockResolvedValue({
				code: "123456",
				expiresAt: new Date(),
			});
			mockVerificationService.sendVerificationEmail.mockResolvedValue(
				undefined,
			);
			mockSecurityLogRepository.create.mockResolvedValue({});
		});

		it("새 사용자를 등록하고 인증 코드를 발송한다", async () => {
			// Given
			// - beforeEach에서 이메일이 존재하지 않도록 설정됨
			// - 비밀번호 해시 및 인증 코드 발송 mock 준비됨

			// When
			const result = await service.register(registerInput);

			// Then
			expect(result.userId).toBe(mockUser.id);
			expect(result.email).toBe(mockUser.email);
			expect(result.message).toContain("회원가입이 완료되었습니다");
		});

		it("이미 존재하는 이메일이면 EMAIL_ALREADY_EXISTS 에러를 던진다", async () => {
			// Given
			mockUserRepository.findByEmail.mockResolvedValue(mockUser);

			// When & Then
			await expect(service.register(registerInput)).rejects.toThrow(
				BusinessException,
			);
		});

		it("비밀번호를 해시하여 저장한다", async () => {
			// Given
			// - beforeEach에서 기본 mock 설정됨

			// When
			await service.register(registerInput);

			// Then
			expect(mockPasswordService.hash).toHaveBeenCalledWith(
				registerInput.password,
			);
			expect(mockAccountRepository.createCredentialAccount).toHaveBeenCalled();
		});

		it("credential 계정을 생성한다", async () => {
			// Given
			// - beforeEach에서 기본 mock 설정됨

			// When
			await service.register(registerInput);

			// Then
			expect(
				mockAccountRepository.createCredentialAccount,
			).toHaveBeenCalledWith(
				mockUser.id,
				"hashed-password",
				expect.any(Object),
			);
		});

		it("이메일 인증 코드를 발송한다", async () => {
			// Given
			// - beforeEach에서 기본 mock 설정됨

			// When
			await service.register(registerInput);

			// Then
			// 새 아키텍처: createEmailVerification (DB 저장) + sendVerificationEmail (이메일 발송)
			expect(
				mockVerificationService.createEmailVerification,
			).toHaveBeenCalled();
			expect(
				mockVerificationService.sendVerificationEmail,
			).toHaveBeenCalledWith(
				registerInput.email,
				expect.any(String), // verification code
			);
		});

		it("보안 로그를 기록한다", async () => {
			// Given
			// - beforeEach에서 기본 mock 설정됨

			// When
			await service.register(registerInput);

			// Then
			expect(mockSecurityLogRepository.create).toHaveBeenCalledWith(
				expect.objectContaining({
					userId: mockUser.id,
					event: SECURITY_EVENT.REGISTRATION,
				}),
				expect.any(Object),
			);
		});

		it("이메일 전송 실패해도 회원가입은 성공한다", async () => {
			// Given
			// - createEmailVerification은 성공 (DB 저장됨)
			mockVerificationService.createEmailVerification.mockResolvedValue({
				code: "123456",
				expiresAt: new Date(),
			});
			// - sendVerificationEmail은 실패 (예외 발생)
			mockVerificationService.sendVerificationEmail.mockRejectedValue(
				new Error("SMTP connection failed"),
			);
			mockUserRepository.create.mockResolvedValue(mockUser);
			mockAccountRepository.createCredentialAccount.mockResolvedValue({});
			mockSecurityLogRepository.create.mockResolvedValue({});

			// When
			const result = await service.register(registerInput);

			// Then
			// 회원가입은 성공해야 함
			expect(result.userId).toBe(mockUser.id);
			expect(result.email).toBe(mockUser.email);
			// 사용자는 DB에 저장되어야 함
			expect(mockUserRepository.create).toHaveBeenCalled();
			// 비록 이메일 전송이 실패했지만 예외를 던지지 않음
		});

		it("이메일 전송 실패 시 로그가 남는다", async () => {
			// Given
			mockVerificationService.createEmailVerification.mockResolvedValue({
				code: "123456",
				expiresAt: new Date(),
			});
			const emailError = new Error("SMTP connection failed");
			mockVerificationService.sendVerificationEmail.mockRejectedValue(
				emailError,
			);
			mockUserRepository.create.mockResolvedValue(mockUser);
			mockAccountRepository.createCredentialAccount.mockResolvedValue({});
			mockSecurityLogRepository.create.mockResolvedValue({});

			// When
			await service.register(registerInput);

			// Then
			// 이메일 전송 시도가 있었고 실패했음을 확인
			expect(
				mockVerificationService.sendVerificationEmail,
			).toHaveBeenCalledWith(registerInput.email, "123456");
		});
	});

	// ============================================
	// verifyEmail
	// ============================================

	describe("verifyEmail", () => {
		const verifyInput = {
			email: "test@example.com",
			code: "123456",
		};

		const mockUser: Partial<User> = {
			id: "user-123",
			email: "test@example.com",
			status: "PENDING_VERIFY",
			emailVerifiedAt: null,
			createdAt: new Date(),
			updatedAt: new Date(),
		};

		const mockTokens = {
			accessToken: "access-token",
			refreshToken: "refresh-token",
			expiresIn: 900,
		};

		beforeEach(() => {
			mockUserRepository.findByEmail.mockResolvedValue(mockUser);
			mockDatabase.$transaction.mockImplementation(async (callback) => {
				return callback({});
			});
			mockVerificationService.verifyCode.mockResolvedValue(true);
			mockUserRepository.markEmailVerified.mockResolvedValue({});
			mockTokenService.generateTokenFamily.mockReturnValue("family-id");
			mockTokenService.getRefreshTokenExpiresInSeconds.mockReturnValue(604800);
			mockSessionRepository.create.mockResolvedValue({
				id: "session-id",
				userId: mockUser.id,
			});
			mockTokenService.generateTokenPair.mockResolvedValue(mockTokens);
			mockTokenService.hashRefreshToken.mockReturnValue("hashed-refresh-token");
			mockSessionRepository.updateRefreshTokenHash.mockResolvedValue({});
			mockSecurityLogRepository.create.mockResolvedValue({});
		});

		it("올바른 코드로 이메일 인증에 성공한다", async () => {
			// Given
			// - beforeEach에서 유효한 사용자와 인증 코드 설정됨

			// When
			const result = await service.verifyEmail(verifyInput);

			// Then
			expect(result.userId).toBe(mockUser.id);
			expect(result.tokens).toEqual(mockTokens);
		});

		it("존재하지 않는 이메일이면 USER_NOT_FOUND 에러를 던진다", async () => {
			// Given
			mockUserRepository.findByEmail.mockResolvedValue(null);

			// When & Then
			await expect(service.verifyEmail(verifyInput)).rejects.toThrow(
				BusinessException,
			);
		});

		it("이미 인증된 사용자면 ALREADY_VERIFIED 에러를 던진다", async () => {
			// Given
			mockUserRepository.findByEmail.mockResolvedValue({
				...mockUser,
				status: "ACTIVE",
				emailVerifiedAt: new Date(),
			});

			// When & Then
			await expect(service.verifyEmail(verifyInput)).rejects.toThrow(
				BusinessException,
			);
		});

		it("인증 성공 시 토큰을 발급한다", async () => {
			// Given
			// - beforeEach에서 기본 mock 설정됨

			// When
			const result = await service.verifyEmail(verifyInput);

			// Then
			expect(mockTokenService.generateTokenPair).toHaveBeenCalled();
			expect(result.tokens.accessToken).toBe(mockTokens.accessToken);
		});

		it("세션을 생성한다", async () => {
			// Given
			// - beforeEach에서 기본 mock 설정됨

			// When
			await service.verifyEmail(verifyInput);

			// Then
			expect(mockSessionRepository.create).toHaveBeenCalled();
		});

		it("보안 이벤트를 기록한다", async () => {
			// Given
			// - beforeEach에서 기본 mock 설정됨

			// When
			await service.verifyEmail(verifyInput);

			// Then
			expect(mockSecurityLogRepository.create).toHaveBeenCalledWith(
				expect.objectContaining({
					userId: mockUser.id,
					event: SECURITY_EVENT.EMAIL_VERIFIED,
				}),
				expect.any(Object),
			);
		});
	});

	// ============================================
	// login
	// ============================================

	describe("login", () => {
		const loginInput = {
			email: "test@example.com",
			password: "Password123!",
		};

		const mockUser: Partial<User> = {
			id: "user-123",
			email: "test@example.com",
			status: "ACTIVE",
			emailVerifiedAt: new Date(),
			createdAt: new Date(),
			updatedAt: new Date(),
		};

		const mockAccount = {
			id: "account-123",
			userId: mockUser.id,
			type: "CREDENTIAL",
			password: "hashed-password",
		};

		const mockTokens = {
			accessToken: "access-token",
			refreshToken: "refresh-token",
			expiresIn: 900,
		};

		beforeEach(() => {
			mockLoginAttemptRepository.countRecentFailuresByEmail.mockResolvedValue(
				0,
			);
			mockUserRepository.findByEmail.mockResolvedValue(mockUser);
			mockAccountRepository.findByUserIdAndProvider.mockResolvedValue(
				mockAccount,
			);
			mockPasswordService.verify.mockResolvedValue(true);
			mockDatabase.$transaction.mockImplementation(async (callback) => {
				return callback({});
			});
			mockTokenService.generateTokenFamily.mockReturnValue("family-id");
			mockTokenService.getRefreshTokenExpiresInSeconds.mockReturnValue(604800);
			mockSessionRepository.create.mockResolvedValue({
				id: "session-id",
				userId: mockUser.id,
			});
			mockTokenService.generateTokenPair.mockResolvedValue(mockTokens);
			mockTokenService.hashRefreshToken.mockReturnValue("hashed-refresh-token");
			mockSessionRepository.updateRefreshTokenHash.mockResolvedValue({});
			mockLoginAttemptRepository.create.mockResolvedValue({});
			mockSecurityLogRepository.create.mockResolvedValue({});
		});

		it("올바른 자격 증명으로 토큰을 반환한다", async () => {
			// Given
			// - beforeEach에서 유효한 사용자와 계정 설정됨

			// When
			const result = await service.login(loginInput);

			// Then
			expect(result.userId).toBe(mockUser.id);
			expect(result.tokens).toEqual(mockTokens);
			expect(result.sessionId).toBe("session-id");
		});

		it("존재하지 않는 이메일이면 INVALID_CREDENTIALS 에러를 던진다", async () => {
			// Given
			mockUserRepository.findByEmail.mockResolvedValue(null);

			// When & Then
			await expect(service.login(loginInput)).rejects.toThrow(
				BusinessException,
			);
			expect(mockLoginAttemptRepository.create).toHaveBeenCalledWith(
				expect.objectContaining({ success: false }),
			);
		});

		it("잘못된 비밀번호면 INVALID_CREDENTIALS 에러를 던진다", async () => {
			// Given
			mockPasswordService.verify.mockResolvedValue(false);

			// When & Then
			await expect(service.login(loginInput)).rejects.toThrow(
				BusinessException,
			);
			expect(mockLoginAttemptRepository.create).toHaveBeenCalledWith(
				expect.objectContaining({ success: false }),
			);
		});

		it("이메일 미인증 사용자면 EMAIL_NOT_VERIFIED 에러를 던진다", async () => {
			// Given
			mockUserRepository.findByEmail.mockResolvedValue({
				...mockUser,
				status: "PENDING_VERIFY",
			});

			// When & Then
			await expect(service.login(loginInput)).rejects.toThrow(
				BusinessException,
			);
		});

		it("세션을 생성하고 보안 이벤트를 기록한다", async () => {
			// Given
			// - beforeEach에서 기본 mock 설정됨

			// When
			await service.login(loginInput);

			// Then
			expect(mockSessionRepository.create).toHaveBeenCalled();
			expect(mockSecurityLogRepository.create).toHaveBeenCalledWith(
				expect.objectContaining({
					userId: mockUser.id,
					event: SECURITY_EVENT.LOGIN_SUCCESS,
				}),
				expect.any(Object),
			);
		});

		it("로그인 시도를 기록한다", async () => {
			// Given
			// - beforeEach에서 기본 mock 설정됨

			// When
			await service.login(loginInput);

			// Then
			expect(mockLoginAttemptRepository.create).toHaveBeenCalledWith(
				expect.objectContaining({
					email: loginInput.email,
					provider: "CREDENTIAL",
					success: true,
				}),
				expect.any(Object),
			);
		});

		it("로그인 시도 횟수 초과 시 ACCOUNT_LOCKED 에러를 던진다", async () => {
			// Given
			mockLoginAttemptRepository.countRecentFailuresByEmail.mockResolvedValue(
				LOGIN_ATTEMPT.MAX_FAILURES,
			);

			// When & Then
			await expect(service.login(loginInput)).rejects.toThrow(
				BusinessException,
			);
		});

		it("계정이 잠긴 상태면 ACCOUNT_LOCKED 에러를 던진다", async () => {
			// Given
			mockUserRepository.findByEmail.mockResolvedValue({
				...mockUser,
				status: "LOCKED",
			});

			// When & Then
			await expect(service.login(loginInput)).rejects.toThrow(
				BusinessException,
			);
		});
	});

	// ============================================
	// logout
	// ============================================

	describe("logout", () => {
		const userId = "user-123";
		const sessionId = "session-123";

		const mockSession: Partial<Session> = {
			id: sessionId,
			userId,
			revokedAt: null,
			expiresAt: new Date(Date.now() + 86400000),
		};

		beforeEach(() => {
			mockSessionRepository.findById.mockResolvedValue(mockSession);
			mockSessionRepository.revoke.mockResolvedValue({});
			mockSecurityLogRepository.create.mockResolvedValue({});
		});

		it("현재 세션을 비활성화한다", async () => {
			// Given
			// - beforeEach에서 유효한 세션 설정됨

			// When
			const result = await service.logout(userId, sessionId);

			// Then
			expect(mockSessionRepository.revoke).toHaveBeenCalledWith(
				sessionId,
				REVOKE_REASON.USER_LOGOUT,
			);
			expect(result.message).toContain("로그아웃");
		});

		it("보안 이벤트를 기록한다", async () => {
			// Given
			// - beforeEach에서 기본 mock 설정됨

			// When
			await service.logout(userId, sessionId);

			// Then
			expect(mockSecurityLogRepository.create).toHaveBeenCalledWith(
				expect.objectContaining({
					userId,
					event: SECURITY_EVENT.LOGOUT,
				}),
			);
		});

		it("존재하지 않는 세션이면 SESSION_NOT_FOUND 에러를 던진다", async () => {
			// Given
			mockSessionRepository.findById.mockResolvedValue(null);

			// When & Then
			await expect(service.logout(userId, sessionId)).rejects.toThrow(
				BusinessException,
			);
		});

		it("이미 폐기된 세션이면 SESSION_REVOKED 에러를 던진다", async () => {
			// Given
			mockSessionRepository.findById.mockResolvedValue({
				...mockSession,
				revokedAt: new Date(),
			});

			// When & Then
			await expect(service.logout(userId, sessionId)).rejects.toThrow(
				BusinessException,
			);
		});

		it("다른 사용자의 세션이면 SESSION_UNAUTHORIZED 에러를 던진다", async () => {
			// Given
			mockSessionRepository.findById.mockResolvedValue({
				...mockSession,
				userId: "other-user",
			});

			// When & Then
			await expect(service.logout(userId, sessionId)).rejects.toThrow(
				BusinessException,
			);
		});
	});

	// ============================================
	// logoutAll
	// ============================================

	describe("logoutAll", () => {
		const userId = "user-123";

		beforeEach(() => {
			mockSessionRepository.revokeAllByUserId.mockResolvedValue(3);
			mockSecurityLogRepository.create.mockResolvedValue({});
		});

		it("사용자의 모든 세션을 비활성화한다", async () => {
			// Given
			// - beforeEach에서 3개 세션이 폐기되도록 설정됨

			// When
			const result = await service.logoutAll(userId);

			// Then
			expect(mockSessionRepository.revokeAllByUserId).toHaveBeenCalledWith(
				userId,
				REVOKE_REASON.USER_LOGOUT_ALL,
			);
			expect(result.revokedCount).toBe(3);
		});

		it("보안 이벤트를 기록한다", async () => {
			// Given
			// - beforeEach에서 기본 mock 설정됨

			// When
			await service.logoutAll(userId);

			// Then
			expect(mockSecurityLogRepository.create).toHaveBeenCalledWith(
				expect.objectContaining({
					userId,
					event: SECURITY_EVENT.SESSION_REVOKED_ALL,
				}),
			);
		});
	});

	// ============================================
	// refreshTokens
	// ============================================

	describe("refreshTokens", () => {
		const refreshToken = "refresh-token";
		const userId = "user-123";
		const sessionId = "session-123";

		const mockPayload = {
			sub: userId,
			email: "test@example.com",
			sessionId,
		};

		const mockSession: Partial<Session> = {
			id: sessionId,
			userId,
			tokenFamily: "family-id",
			tokenVersion: 1,
			revokedAt: null,
			expiresAt: new Date(Date.now() + 86400000),
		};

		const mockNewTokens = {
			accessToken: "new-access-token",
			refreshToken: "new-refresh-token",
			expiresIn: 900,
		};

		beforeEach(() => {
			mockTokenService.verifyRefreshToken.mockResolvedValue(mockPayload);
			mockTokenService.hashRefreshToken.mockReturnValue("hashed-token");
			mockSessionRepository.findByRefreshTokenHash.mockResolvedValue(
				mockSession,
			);
			mockSessionRepository.findByPreviousTokenHash.mockResolvedValue(null);
			mockTokenService.generateTokenPair.mockResolvedValue(mockNewTokens);
			mockSessionRepository.rotateToken.mockResolvedValue({
				...mockSession,
				tokenVersion: 2,
			});
			mockSecurityLogRepository.create.mockResolvedValue({});
		});

		it("유효한 리프레시 토큰으로 새 토큰 쌍을 발급한다", async () => {
			// Given
			// - beforeEach에서 유효한 세션과 토큰 설정됨

			// When
			const result = await service.refreshTokens(refreshToken);

			// Then
			expect(result.tokens).toEqual(mockNewTokens);
			expect(result.sessionId).toBe(sessionId);
		});

		it("토큰 로테이션을 수행한다", async () => {
			// Given
			// - beforeEach에서 기본 mock 설정됨

			// When
			await service.refreshTokens(refreshToken);

			// Then
			expect(mockSessionRepository.rotateToken).toHaveBeenCalledWith(
				sessionId,
				expect.objectContaining({
					tokenVersion: 2,
					expectedTokenVersion: 1,
				}),
			);
		});

		it("유효하지 않은 리프레시 토큰이면 INVALID_REFRESH_TOKEN 에러를 던진다", async () => {
			// Given
			mockTokenService.verifyRefreshToken.mockResolvedValue(null);

			// When & Then
			await expect(service.refreshTokens(refreshToken)).rejects.toThrow(
				BusinessException,
			);
		});

		it("토큰 재사용이 감지되면 토큰 패밀리를 폐기하고 TOKEN_REUSE_DETECTED 에러를 던진다", async () => {
			// Given
			mockSessionRepository.findByRefreshTokenHash.mockResolvedValue(null);
			mockSessionRepository.findByPreviousTokenHash.mockResolvedValue(
				mockSession,
			);

			// When & Then
			await expect(service.refreshTokens(refreshToken)).rejects.toThrow(
				BusinessException,
			);

			expect(mockSessionRepository.revokeByTokenFamily).toHaveBeenCalledWith(
				mockSession.tokenFamily,
				REVOKE_REASON.TOKEN_REUSE_DETECTED,
			);

			expect(mockSecurityLogRepository.create).toHaveBeenCalledWith(
				expect.objectContaining({
					event: SECURITY_EVENT.SUSPICIOUS_ACTIVITY,
				}),
			);
		});

		it("폐기된 세션이면 SESSION_REVOKED 에러를 던진다", async () => {
			// Given
			mockSessionRepository.findByRefreshTokenHash.mockResolvedValue({
				...mockSession,
				revokedAt: new Date(),
			});

			// When & Then
			await expect(service.refreshTokens(refreshToken)).rejects.toThrow(
				BusinessException,
			);
		});

		it("만료된 세션이면 SESSION_EXPIRED 에러를 던진다", async () => {
			// Given
			mockSessionRepository.findByRefreshTokenHash.mockResolvedValue({
				...mockSession,
				expiresAt: new Date(Date.now() - 1000),
			});

			// When & Then
			await expect(service.refreshTokens(refreshToken)).rejects.toThrow(
				BusinessException,
			);
		});

		it("토큰 로테이션 실패 시 TOKEN_ROTATION_FAILED 에러를 던진다", async () => {
			// Given
			mockSessionRepository.rotateToken.mockResolvedValue(null);

			// When & Then
			await expect(service.refreshTokens(refreshToken)).rejects.toThrow(
				BusinessException,
			);
		});
	});

	// ============================================
	// forgotPassword
	// ============================================

	describe("forgotPassword", () => {
		const email = "test@example.com";

		const mockUser: Partial<User> = {
			id: "user-123",
			email,
		};

		beforeEach(() => {
			mockUserRepository.findByEmail.mockResolvedValue(mockUser);
			mockVerificationService.createAndSendPasswordReset.mockResolvedValue({
				code: "123456",
				expiresAt: new Date(),
			});
		});

		it("비밀번호 재설정 코드를 발송한다", async () => {
			// Given
			// - beforeEach에서 유효한 사용자 설정됨

			// When
			const result = await service.forgotPassword(email);

			// Then
			expect(
				mockVerificationService.createAndSendPasswordReset,
			).toHaveBeenCalledWith(mockUser.id, email);
			expect(result.message).toBeDefined();
		});

		it("존재하지 않는 이메일도 동일한 응답을 반환한다 (보안)", async () => {
			// Given
			mockUserRepository.findByEmail.mockResolvedValue(null);

			// When
			const result = await service.forgotPassword(email);

			// Then
			expect(result.message).toBeDefined();
			expect(
				mockVerificationService.createAndSendPasswordReset,
			).not.toHaveBeenCalled();
		});
	});

	// ============================================
	// resetPassword
	// ============================================

	describe("resetPassword", () => {
		const email = "test@example.com";
		const code = "123456";
		const newPassword = "NewPassword123!";

		const mockUser: Partial<User> = {
			id: "user-123",
			email,
		};

		const mockAccount = {
			id: "account-123",
			userId: mockUser.id,
			type: "CREDENTIAL",
			password: "old-hashed-password",
		};

		beforeEach(() => {
			mockUserRepository.findByEmail.mockResolvedValue(mockUser);
			mockAccountRepository.findByUserIdAndProvider.mockResolvedValue(
				mockAccount,
			);
			mockPasswordService.hash.mockResolvedValue("new-hashed-password");
			mockDatabase.$transaction.mockImplementation(async (callback) => {
				return callback({});
			});
			mockVerificationService.verifyCode.mockResolvedValue(true);
			mockAccountRepository.updatePassword.mockResolvedValue({});
			mockSessionRepository.revokeAllByUserId.mockResolvedValue(2);
			mockSecurityLogRepository.create.mockResolvedValue({});
		});

		it("올바른 코드로 비밀번호를 재설정한다", async () => {
			// Given
			// - beforeEach에서 유효한 사용자와 인증 코드 설정됨

			// When
			const result = await service.resetPassword(email, code, newPassword);

			// Then
			expect(result.message).toContain("비밀번호가 재설정되었습니다");
		});

		it("인증 코드를 검증한다", async () => {
			// Given
			// - beforeEach에서 기본 mock 설정됨

			// When
			await service.resetPassword(email, code, newPassword);

			// Then
			expect(mockVerificationService.verifyCode).toHaveBeenCalledWith(
				mockUser.id,
				code,
				"PASSWORD_RESET",
				expect.any(Object),
			);
		});

		it("비밀번호를 해시하여 업데이트한다", async () => {
			// Given
			// - beforeEach에서 기본 mock 설정됨

			// When
			await service.resetPassword(email, code, newPassword);

			// Then
			expect(mockPasswordService.hash).toHaveBeenCalledWith(newPassword);
			expect(mockAccountRepository.updatePassword).toHaveBeenCalledWith(
				mockUser.id,
				"new-hashed-password",
				expect.any(Object),
			);
		});

		it("모든 기존 세션을 무효화한다", async () => {
			// Given
			// - beforeEach에서 기본 mock 설정됨

			// When
			await service.resetPassword(email, code, newPassword);

			// Then
			expect(mockSessionRepository.revokeAllByUserId).toHaveBeenCalledWith(
				mockUser.id,
				REVOKE_REASON.PASSWORD_RESET,
				undefined,
				expect.any(Object),
			);
		});

		it("존재하지 않는 사용자면 USER_NOT_FOUND 에러를 던진다", async () => {
			// Given
			mockUserRepository.findByEmail.mockResolvedValue(null);

			// When & Then
			await expect(
				service.resetPassword(email, code, newPassword),
			).rejects.toThrow(BusinessException);
		});

		it("Credential 계정이 없으면 CREDENTIAL_ACCOUNT_NOT_FOUND 에러를 던진다", async () => {
			// Given
			mockAccountRepository.findByUserIdAndProvider.mockResolvedValue(null);

			// When & Then
			await expect(
				service.resetPassword(email, code, newPassword),
			).rejects.toThrow(BusinessException);
		});
	});

	// ============================================
	// changePassword
	// ============================================

	describe("changePassword", () => {
		const userId = "user-123";
		const currentPassword = "CurrentPassword123!";
		const newPassword = "NewPassword123!";

		const mockAccount = {
			id: "account-123",
			userId,
			type: "CREDENTIAL",
			password: "current-hashed-password",
		};

		beforeEach(() => {
			mockAccountRepository.findByUserIdAndProvider.mockResolvedValue(
				mockAccount,
			);
			mockPasswordService.verify.mockResolvedValue(true);
			mockPasswordService.hash.mockResolvedValue("new-hashed-password");
			mockDatabase.$transaction.mockImplementation(async (callback) => {
				return callback({});
			});
			mockAccountRepository.updatePassword.mockResolvedValue({});
			mockSecurityLogRepository.create.mockResolvedValue({});
		});

		it("현재 비밀번호 확인 후 새 비밀번호로 변경한다", async () => {
			// Given
			// - beforeEach에서 유효한 계정 설정됨

			// When
			const result = await service.changePassword(
				userId,
				currentPassword,
				newPassword,
			);

			// Then
			expect(mockPasswordService.verify).toHaveBeenCalledWith(
				mockAccount.password,
				currentPassword,
			);
			expect(mockAccountRepository.updatePassword).toHaveBeenCalledWith(
				userId,
				"new-hashed-password",
				expect.any(Object),
			);
			expect(result.message).toContain("비밀번호가 변경되었습니다");
		});

		it("현재 비밀번호가 틀리면 INVALID_CREDENTIALS 에러를 던진다", async () => {
			// Given
			mockPasswordService.verify.mockResolvedValue(false);

			// When & Then
			await expect(
				service.changePassword(userId, currentPassword, newPassword),
			).rejects.toThrow(BusinessException);
		});

		it("Credential 계정이 없으면 CREDENTIAL_ACCOUNT_NOT_FOUND 에러를 던진다", async () => {
			// Given
			mockAccountRepository.findByUserIdAndProvider.mockResolvedValue(null);

			// When & Then
			await expect(
				service.changePassword(userId, currentPassword, newPassword),
			).rejects.toThrow(BusinessException);
		});

		it("보안 로그를 기록한다", async () => {
			// Given
			// - beforeEach에서 기본 mock 설정됨

			// When
			await service.changePassword(userId, currentPassword, newPassword);

			// Then
			expect(mockSecurityLogRepository.create).toHaveBeenCalledWith(
				expect.objectContaining({
					userId,
					event: SECURITY_EVENT.PASSWORD_CHANGED,
				}),
				expect.any(Object),
			);
		});
	});

	// ============================================
	// getActiveSessions
	// ============================================

	describe("getActiveSessions", () => {
		const userId = "user-123";

		const mockSessions = [
			{
				id: "session-1",
				userId,
				ipAddress: "192.168.1.1",
				userAgent: "Chrome/120",
				lastUsedAt: new Date(),
				createdAt: new Date(),
			},
			{
				id: "session-2",
				userId,
				ipAddress: "192.168.1.2",
				userAgent: "Safari/17",
				lastUsedAt: new Date(),
				createdAt: new Date(),
			},
		];

		beforeEach(() => {
			mockSessionRepository.findActiveByUserId.mockResolvedValue(mockSessions);
		});

		it("사용자의 활성 세션 목록을 반환한다", async () => {
			// Given
			// - beforeEach에서 2개의 활성 세션 설정됨

			// When
			const result = await service.getActiveSessions(userId);

			// Then
			expect(result).toHaveLength(2);
			expect(result[0]?.id).toBe("session-1");
			expect(result[1]?.id).toBe("session-2");
		});

		it("세션 정보를 올바르게 매핑한다", async () => {
			// Given
			// - beforeEach에서 기본 mock 설정됨

			// When
			const result = await service.getActiveSessions(userId);

			// Then
			expect(result[0]).toEqual(
				expect.objectContaining({
					id: "session-1",
					ipAddress: "192.168.1.1",
					userAgent: "Chrome/120",
					isCurrent: false,
				}),
			);
		});
	});

	// ============================================
	// revokeSession
	// ============================================

	describe("revokeSession", () => {
		const userId = "user-123";
		const sessionId = "session-123";

		const mockSession: Partial<Session> = {
			id: sessionId,
			userId,
		};

		beforeEach(() => {
			mockSessionRepository.findById.mockResolvedValue(mockSession);
			mockSessionRepository.revoke.mockResolvedValue({});
			mockSecurityLogRepository.create.mockResolvedValue({});
		});

		it("특정 세션을 폐기한다", async () => {
			// Given
			// - beforeEach에서 유효한 세션 설정됨

			// When
			const result = await service.revokeSession(userId, sessionId);

			// Then
			expect(mockSessionRepository.revoke).toHaveBeenCalledWith(
				sessionId,
				REVOKE_REASON.USER_REVOKE,
			);
			expect(result.message).toContain("세션이 종료되었습니다");
		});

		it("보안 로그를 기록한다", async () => {
			// Given
			// - beforeEach에서 기본 mock 설정됨

			// When
			await service.revokeSession(userId, sessionId);

			// Then
			expect(mockSecurityLogRepository.create).toHaveBeenCalledWith(
				expect.objectContaining({
					userId,
					event: SECURITY_EVENT.SESSION_REVOKED,
					metadata: { revokedSessionId: sessionId },
				}),
			);
		});

		it("존재하지 않는 세션이면 SESSION_NOT_FOUND 에러를 던진다", async () => {
			// Given
			mockSessionRepository.findById.mockResolvedValue(null);

			// When & Then
			await expect(service.revokeSession(userId, sessionId)).rejects.toThrow(
				BusinessException,
			);
		});

		it("다른 사용자의 세션이면 SESSION_UNAUTHORIZED 에러를 던진다", async () => {
			// Given
			mockSessionRepository.findById.mockResolvedValue({
				...mockSession,
				userId: "other-user",
			});

			// When & Then
			await expect(service.revokeSession(userId, sessionId)).rejects.toThrow(
				BusinessException,
			);
		});
	});

	// ============================================
	// resendVerification
	// ============================================

	describe("resendVerification", () => {
		const email = "test@example.com";

		const mockUser: Partial<User> = {
			id: "user-123",
			email,
			status: "PENDING_VERIFY",
			emailVerifiedAt: null,
		};

		beforeEach(() => {
			mockUserRepository.findByEmail.mockResolvedValue(mockUser);
			mockVerificationService.createAndSendEmailVerification.mockResolvedValue({
				code: "123456",
				expiresAt: new Date(),
			});
			mockVerificationService.createEmailVerification.mockResolvedValue({
				code: "123456",
				expiresAt: new Date(),
			});
			mockVerificationService.sendVerificationEmail.mockResolvedValue(
				undefined,
			);
		});

		it("인증 코드를 재발송한다", async () => {
			// Given
			// - beforeEach에서 미인증 사용자 설정됨

			// When
			const result = await service.resendVerification(email);

			// Then
			// 새 아키텍처: createEmailVerification (DB 저장) + sendVerificationEmail (이메일 발송)
			expect(
				mockVerificationService.createEmailVerification,
			).toHaveBeenCalled();
			expect(
				mockVerificationService.sendVerificationEmail,
			).toHaveBeenCalledWith(
				email,
				expect.any(String), // verification code
			);
			expect(result.message).toBeDefined();
		});

		it("존재하지 않는 이메일도 동일한 응답을 반환한다 (보안)", async () => {
			// Given
			mockUserRepository.findByEmail.mockResolvedValue(null);

			// When
			const result = await service.resendVerification(email);

			// Then
			expect(result.message).toBeDefined();
			expect(
				mockVerificationService.createAndSendEmailVerification,
			).not.toHaveBeenCalled();
		});

		it("이미 인증된 사용자면 ALREADY_VERIFIED 에러를 던진다", async () => {
			// Given
			mockUserRepository.findByEmail.mockResolvedValue({
				...mockUser,
				status: "ACTIVE",
				emailVerifiedAt: new Date(),
			});

			// When & Then
			await expect(service.resendVerification(email)).rejects.toThrow(
				BusinessException,
			);
		});

		it("이메일 전송 실패해도 재전송 요청은 성공한다", async () => {
			// Given
			mockVerificationService.createEmailVerification.mockResolvedValue({
				code: "654321",
				expiresAt: new Date(),
			});
			mockVerificationService.sendVerificationEmail.mockRejectedValue(
				new Error("Email service unavailable"),
			);
			mockDatabase.$transaction.mockImplementation(async (callback) => {
				return callback({});
			});

			// When
			const result = await service.resendVerification(email);

			// Then
			// 재전송 요청은 성공해야 함
			expect(result.message).toBeDefined();
			// 이메일 전송 시도가 있었지만 예외를 던지지 않음
			expect(
				mockVerificationService.sendVerificationEmail,
			).toHaveBeenCalledWith(email, "654321");
		});
	});

	// ============================================
	// getCurrentUser (캐싱 테스트)
	// ============================================

	describe("getCurrentUser", () => {
		const userId = "user-123";
		const email = "test@example.com";
		const sessionId = "session-123";

		const mockUserWithProfile = {
			id: userId,
			email,
			userTag: "testuser#1234",
			status: "ACTIVE",
			emailVerifiedAt: new Date("2024-01-01T00:00:00Z"),
			subscriptionStatus: "FREE",
			subscriptionExpiresAt: null,
			createdAt: new Date("2024-01-01T00:00:00Z"),
			profile: {
				name: "Test User",
				profileImage: "https://example.com/image.jpg",
			},
		};

		const cachedProfile = {
			id: userId,
			email,
			userTag: "testuser#1234",
			status: "ACTIVE",
			emailVerifiedAt: "2024-01-01T00:00:00.000Z",
			subscriptionStatus: "FREE",
			subscriptionExpiresAt: null,
			name: "Test User",
			profileImage: "https://example.com/image.jpg",
			createdAt: "2024-01-01T00:00:00.000Z",
		};

		beforeEach(() => {
			mockUserRepository.findByIdWithProfile.mockResolvedValue(
				mockUserWithProfile,
			);
			// wrapUserProfile mock: factory를 실행하고 결과 반환
			mockCacheService.wrapUserProfile.mockImplementation(
				async (_userId, factory) => factory(),
			);
		});

		it("캐시된 프로필을 조회하여 사용자 정보를 반환한다", async () => {
			// Given
			// wrapUserProfile이 캐시된 값을 반환하도록 설정
			mockCacheService.wrapUserProfile.mockResolvedValue(cachedProfile);

			// When
			const result = await service.getCurrentUser(userId, email, sessionId);

			// Then
			expect(result.userId).toBe(userId);
			expect(result.email).toBe(email);
			expect(result.sessionId).toBe(sessionId);
			expect(result.name).toBe("Test User");
			expect(result.profileImage).toBe("https://example.com/image.jpg");
			expect(mockCacheService.wrapUserProfile).toHaveBeenCalledWith(
				userId,
				expect.any(Function),
			);
		});

		it("캐시 미스 시 DB에서 조회하고 캐시에 저장한다", async () => {
			// Given
			// wrapUserProfile이 factory를 실행하도록 설정 (캐시 미스 시나리오)
			mockCacheService.wrapUserProfile.mockImplementation(
				async (_userId, factory) => factory(),
			);

			// When
			const result = await service.getCurrentUser(userId, email, sessionId);

			// Then
			expect(mockUserRepository.findByIdWithProfile).toHaveBeenCalledWith(
				userId,
			);
			expect(result.userId).toBe(userId);
			expect(result.email).toBe(email);
		});

		it("사용자가 존재하지 않으면 USER_NOT_FOUND 에러를 던진다", async () => {
			// Given
			mockCacheService.wrapUserProfile.mockImplementation(
				async (_userId, factory) => factory(),
			);
			mockUserRepository.findByIdWithProfile.mockResolvedValue(null);

			// When & Then
			await expect(
				service.getCurrentUser(userId, email, sessionId),
			).rejects.toThrow(BusinessException);
		});

		it("프로필이 없는 사용자도 처리한다", async () => {
			// Given
			const userWithoutProfile = {
				...mockUserWithProfile,
				profile: null,
			};
			mockCacheService.wrapUserProfile.mockImplementation(
				async (_userId, factory) => factory(),
			);
			mockUserRepository.findByIdWithProfile.mockResolvedValue(
				userWithoutProfile,
			);

			// When
			const result = await service.getCurrentUser(userId, email, sessionId);

			// Then
			expect(result.name).toBeNull();
			expect(result.profileImage).toBeNull();
		});

		it("sessionId는 캐시되지 않고 항상 파라미터 값을 사용한다", async () => {
			// Given
			mockCacheService.wrapUserProfile.mockResolvedValue(cachedProfile);
			const differentSessionId = "different-session-456";

			// When
			const result = await service.getCurrentUser(
				userId,
				email,
				differentSessionId,
			);

			// Then
			expect(result.sessionId).toBe(differentSessionId);
		});
	});

	// ============================================
	// updateProfile (캐시 무효화 테스트)
	// ============================================

	describe("updateProfile", () => {
		const userId = "user-123";
		const updateData = {
			name: "Updated Name",
		};

		const updatedProfile = {
			name: "Updated Name",
			profileImage: "https://example.com/image.jpg",
		};

		beforeEach(() => {
			mockUserRepository.updateProfile = jest
				.fn()
				.mockResolvedValue(updatedProfile);
			mockCacheService.invalidateUserProfile.mockResolvedValue(undefined);
		});

		it("프로필을 업데이트하고 캐시를 무효화한다", async () => {
			// Given
			// - beforeEach에서 기본 mock 설정됨

			// When
			const result = await service.updateProfile(userId, updateData);

			// Then
			expect(result.message).toContain("프로필이 수정되었습니다");
			expect(result.name).toBe("Updated Name");
			expect(mockCacheService.invalidateUserProfile).toHaveBeenCalledWith(
				userId,
			);
		});

		it("프로필 업데이트 후 캐시 무효화가 호출된다", async () => {
			// Given
			// - beforeEach에서 기본 mock 설정됨

			// When
			await service.updateProfile(userId, updateData);

			// Then
			// updateProfile -> invalidateUserProfile 순서로 호출되어야 함
			const updateCallOrder =
				mockUserRepository.updateProfile.mock.invocationCallOrder[0];
			const invalidateCallOrder =
				mockCacheService.invalidateUserProfile.mock.invocationCallOrder[0];
			expect(invalidateCallOrder).toBeGreaterThan(updateCallOrder as number);
		});

		it("프로필 이미지를 업데이트할 수 있다", async () => {
			// Given
			const imageUpdateData = {
				profileImage: "https://example.com/new-image.jpg",
			};
			mockUserRepository.updateProfile.mockResolvedValue({
				name: "Test User",
				profileImage: "https://example.com/new-image.jpg",
			});

			// When
			const result = await service.updateProfile(userId, imageUpdateData);

			// Then
			expect(result.profileImage).toBe("https://example.com/new-image.jpg");
			expect(mockCacheService.invalidateUserProfile).toHaveBeenCalledWith(
				userId,
			);
		});
	});
});
