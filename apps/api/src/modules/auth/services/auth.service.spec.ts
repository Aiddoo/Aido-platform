/**
 * AuthService 테스트 (Suites 패턴)
 *
 * NestJS 공식 권장 Suites 라이브러리 사용
 * - 자동 Mock 생성으로 보일러플레이트 제거
 * - Builder 패턴으로 테스트 데이터 생성
 * - 행동 기반 assertion
 *
 * @see https://docs.nestjs.com/recipes/suites
 */
import { LOGIN_ATTEMPT } from "@aido/validators";
import type { Mocked } from "@suites/doubles.jest";
import { TestBed } from "@suites/unit";
import { SessionBuilder, UserBuilder } from "@test/builders";
import { type TransactionCallback } from "@test/mocks";
import { CacheService } from "@/common/cache/cache.service";
import type { TransactionClient } from "@/common/database/prisma.types";
import {
	BusinessException,
	BusinessExceptions,
} from "@/common/exception/services/business-exception.service";
import { DatabaseService } from "@/database";
import {
	type Account,
	type LoginAttempt,
	Prisma,
	type SecurityLog,
	type Session,
	type User,
} from "@/generated/prisma/client";
import type { AccountProvider } from "@/generated/prisma/enums";
import { AdminNotificationQueueService } from "@/modules/admin-notification/queue/admin-notification-queue.service";
import { REVOKE_REASON, SECURITY_EVENT } from "../constants/auth.constants";
import { AccountRepository } from "../repositories/account.repository";
import { LoginAttemptRepository } from "../repositories/login-attempt.repository";
import { SecurityLogRepository } from "../repositories/security-log.repository";
import { SessionRepository } from "../repositories/session.repository";
import { UserRepository } from "../repositories/user.repository";
import { AuthService } from "./auth.service";
import { PasswordService } from "./password.service";
import { SessionService } from "./session.service";
import type { JwtPayload } from "./token.service";
import { TokenService } from "./token.service";
import { VerificationService } from "./verification.service";

describe("AuthService", () => {
	let service: AuthService;
	let userRepo: Mocked<UserRepository>;
	let accountRepo: Mocked<AccountRepository>;
	let sessionRepo: Mocked<SessionRepository>;
	let passwordService: Mocked<PasswordService>;
	let tokenService: Mocked<TokenService>;
	let verificationService: Mocked<VerificationService>;
	let cacheService: Mocked<CacheService>;
	let database: Mocked<DatabaseService>;
	let securityLogRepo: Mocked<SecurityLogRepository>;
	let loginAttemptRepo: Mocked<LoginAttemptRepository>;
	let sessionService: Mocked<SessionService>;
	let adminNotificationQueueService: Mocked<AdminNotificationQueueService>;

	// 재사용 가능한 테스트 데이터
	const mockTokens = {
		accessToken: "access-token",
		refreshToken: "refresh-token",
		expiresIn: 900,
	};

	beforeEach(async () => {
		// Suites가 모든 의존성을 자동으로 mock
		const { unit, unitRef } = await TestBed.solitary(AuthService).compile();

		service = unit;
		userRepo = unitRef.get(UserRepository);
		accountRepo = unitRef.get(AccountRepository);
		sessionRepo = unitRef.get(SessionRepository);
		passwordService = unitRef.get(PasswordService);
		tokenService = unitRef.get(TokenService);
		verificationService = unitRef.get(VerificationService);
		cacheService = unitRef.get(CacheService);
		database = unitRef.get(DatabaseService);
		securityLogRepo = unitRef.get(SecurityLogRepository);
		loginAttemptRepo = unitRef.get(LoginAttemptRepository);
		sessionService = unitRef.get(SessionService);
		adminNotificationQueueService = unitRef.get(AdminNotificationQueueService);
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

		/**
		 * 회원가입 성공 시나리오 mock 설정 헬퍼
		 */
		const setupSuccessfulRegistration = (
			mockUser: ReturnType<typeof UserBuilder.prototype.build>,
		) => {
			userRepo.findByEmail.mockResolvedValue(null);
			passwordService.hash.mockResolvedValue("hashed-password");
			database.$transaction.mockImplementation(
				async (callback: TransactionCallback) => {
					const mockTx = {
						userConsent: { create: jest.fn() },
						userPreference: { create: jest.fn() },
						todoCategory: {
							createMany: jest.fn().mockResolvedValue({ count: 2 }),
						},
					};
					return callback(mockTx as unknown as TransactionClient);
				},
			);
			userRepo.create.mockResolvedValue(mockUser);
			userRepo.createProfile.mockResolvedValue(undefined);
			accountRepo.createCredentialAccount.mockResolvedValue(
				{} as unknown as Account,
			);
			verificationService.createEmailVerification.mockResolvedValue({
				code: "123456",
				expiresAt: new Date(),
			});
			verificationService.sendVerificationEmail.mockResolvedValue(undefined);
			securityLogRepo.create.mockResolvedValue({} as SecurityLog);
		};

		it("새 사용자를 등록하고 인증 코드를 발송한다", async () => {
			// Given - Builder로 테스트 데이터 생성
			const mockUser = UserBuilder.create()
				.withId("user-123")
				.withEmail(registerInput.email)
				.withStatus("PENDING_VERIFY")
				.build();

			setupSuccessfulRegistration(mockUser);

			// When
			const result = await service.register(registerInput);

			// Then - 행동 기반 assertion
			expect(result.userId).toBe(mockUser.id);
			expect(result.email).toBe(mockUser.email);
			expect(result.message).toContain("회원가입이 완료되었습니다");
		});

		it("이미 존재하는 이메일이면 에러를 던진다", async () => {
			// Given
			const existingUser = UserBuilder.create()
				.withEmail(registerInput.email)
				.verified()
				.build();
			userRepo.findByEmail.mockResolvedValue(existingUser);

			// When & Then
			await expect(service.register(registerInput)).rejects.toThrow(
				BusinessException,
			);
		});

		it("비밀번호를 해시하여 저장한다", async () => {
			// Given
			const mockUser = UserBuilder.create()
				.withId("user-123")
				.withEmail(registerInput.email)
				.build();

			setupSuccessfulRegistration(mockUser);

			// When
			await service.register(registerInput);

			// Then
			expect(passwordService.hash).toHaveBeenCalledWith(registerInput.password);
			expect(accountRepo.createCredentialAccount).toHaveBeenCalled();
		});

		it("credential 계정을 생성한다", async () => {
			// Given
			const mockUser = UserBuilder.create()
				.withId("user-123")
				.withEmail(registerInput.email)
				.build();

			setupSuccessfulRegistration(mockUser);

			// When
			await service.register(registerInput);

			// Then
			expect(accountRepo.createCredentialAccount).toHaveBeenCalledWith(
				mockUser.id,
				"hashed-password",
				expect.any(Object),
			);
		});

		it("이메일 인증 코드를 발송한다", async () => {
			// Given
			const mockUser = UserBuilder.create()
				.withId("user-123")
				.withEmail(registerInput.email)
				.build();

			setupSuccessfulRegistration(mockUser);

			// When
			await service.register(registerInput);

			// Then
			expect(verificationService.createEmailVerification).toHaveBeenCalled();
			expect(verificationService.sendVerificationEmail).toHaveBeenCalledWith(
				registerInput.email,
				expect.any(String),
			);
		});

		it("보안 로그를 기록한다", async () => {
			// Given
			const mockUser = UserBuilder.create()
				.withId("user-123")
				.withEmail(registerInput.email)
				.build();

			setupSuccessfulRegistration(mockUser);

			// When
			await service.register(registerInput);

			// Then
			expect(securityLogRepo.create).toHaveBeenCalledWith(
				expect.objectContaining({
					userId: mockUser.id,
					event: SECURITY_EVENT.REGISTRATION,
				}),
				expect.any(Object),
			);
		});

		it("P2002 unique constraint(이메일 중복) 시 emailAlreadyRegistered를 던져야 한다", async () => {
			// Given - 트랜잭션에서 P2002 발생 (동시 가입 race condition)
			database.$transaction.mockRejectedValue(
				new Prisma.PrismaClientKnownRequestError("Unique constraint", {
					code: "P2002",
					meta: { target: ["email"] },
					clientVersion: "7.0.0",
				}),
			);

			// When & Then
			await expect(service.register(registerInput)).rejects.toThrow(
				BusinessExceptions.emailAlreadyRegistered(registerInput.email),
			);
		});

		it("P2002 unique constraint(이메일 외) 시 원본 에러를 re-throw해야 한다", async () => {
			// Given - userTag 충돌 등 email이 아닌 P2002
			const prismaError = new Prisma.PrismaClientKnownRequestError(
				"Unique constraint",
				{
					code: "P2002",
					meta: { target: ["userTag"] },
					clientVersion: "7.0.0",
				},
			);
			database.$transaction.mockRejectedValue(prismaError);

			// When & Then - emailAlreadyRegistered가 아닌 원본 에러가 던져져야 함
			await expect(service.register(registerInput)).rejects.toThrow(
				prismaError,
			);
		});

		it("이메일 전송 실패해도 회원가입은 성공한다", async () => {
			// Given
			const mockUser = UserBuilder.create()
				.withId("user-123")
				.withEmail(registerInput.email)
				.build();

			setupSuccessfulRegistration(mockUser);
			verificationService.sendVerificationEmail.mockRejectedValue(
				new Error("SMTP connection failed"),
			);

			// When
			const result = await service.register(registerInput);

			// Then - 회원가입은 성공
			expect(result.userId).toBe(mockUser.id);
			expect(result.email).toBe(mockUser.email);
		});

		it("회원가입 성공 시 관리자 알림 및 온보딩 큐 잡을 등록한다", async () => {
			// Given
			const mockUser = UserBuilder.create()
				.withId("user-123")
				.withEmail(registerInput.email)
				.build();

			setupSuccessfulRegistration(mockUser);

			// When
			await service.register(registerInput);

			// Then
			expect(
				adminNotificationQueueService.enqueueUserRegistered,
			).toHaveBeenCalledWith(
				expect.objectContaining({
					userId: "user-123",
					email: registerInput.email,
					provider: "credential",
				}),
			);
			// 기본 카테고리는 register() 트랜잭션 내에서 동기 생성됨 (큐 아님)
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

		/**
		 * 이메일 인증 성공 시나리오 mock 설정 헬퍼
		 */
		const setupSuccessfulVerification = (
			mockUser: ReturnType<typeof UserBuilder.prototype.build>,
		) => {
			userRepo.findByEmail.mockResolvedValue(mockUser);
			database.$transaction.mockImplementation(
				async (callback: TransactionCallback) =>
					callback({} as TransactionClient),
			);
			verificationService.verifyCode.mockResolvedValue(true as boolean);
			userRepo.markEmailVerified.mockResolvedValue({} as User);
			sessionService.createSessionWithTokens.mockResolvedValue({
				sessionId: "session-id",
				tokens: mockTokens,
				tokenFamily: "family-id",
			});
			securityLogRepo.create.mockResolvedValue({} as SecurityLog);
			userRepo.findByIdWithProfile.mockResolvedValue({
				...mockUser,
				profile: { name: "Test User", profileImage: null },
			} as never);
		};

		it("올바른 코드로 이메일 인증에 성공한다", async () => {
			// Given
			const mockUser = UserBuilder.create()
				.withId("user-123")
				.withEmail(verifyInput.email)
				.withStatus("PENDING_VERIFY")
				.build();

			setupSuccessfulVerification(mockUser);

			// When
			const result = await service.verifyEmail(verifyInput);

			// Then
			expect(result.userId).toBe(mockUser.id);
			expect(result.tokens).toEqual(mockTokens);
		});

		it("존재하지 않는 이메일이면 에러를 던진다", async () => {
			// Given
			userRepo.findByEmail.mockResolvedValue(null);

			// When & Then
			await expect(service.verifyEmail(verifyInput)).rejects.toThrow(
				BusinessException,
			);
		});

		it("이미 인증된 사용자면 에러를 던진다", async () => {
			// Given
			const verifiedUser = UserBuilder.create()
				.withEmail(verifyInput.email)
				.verified()
				.build();
			userRepo.findByEmail.mockResolvedValue(verifiedUser);

			// When & Then
			await expect(service.verifyEmail(verifyInput)).rejects.toThrow(
				BusinessException,
			);
		});

		it("인증 성공 시 토큰을 발급한다", async () => {
			// Given
			const mockUser = UserBuilder.create()
				.withId("user-123")
				.withEmail(verifyInput.email)
				.withStatus("PENDING_VERIFY")
				.build();

			setupSuccessfulVerification(mockUser);

			// When
			const result = await service.verifyEmail(verifyInput);

			// Then
			expect(sessionService.createSessionWithTokens).toHaveBeenCalled();
			expect(result.tokens.accessToken).toBe(mockTokens.accessToken);
		});

		it("세션을 생성한다", async () => {
			// Given
			const mockUser = UserBuilder.create()
				.withId("user-123")
				.withEmail(verifyInput.email)
				.withStatus("PENDING_VERIFY")
				.build();

			setupSuccessfulVerification(mockUser);

			// When
			await service.verifyEmail(verifyInput);

			// Then
			expect(sessionService.createSessionWithTokens).toHaveBeenCalled();
		});

		it("보안 이벤트를 기록한다", async () => {
			// Given
			const mockUser = UserBuilder.create()
				.withId("user-123")
				.withEmail(verifyInput.email)
				.withStatus("PENDING_VERIFY")
				.build();

			setupSuccessfulVerification(mockUser);

			// When
			await service.verifyEmail(verifyInput);

			// Then
			expect(securityLogRepo.create).toHaveBeenCalledWith(
				expect.objectContaining({
					userId: mockUser.id,
					event: SECURITY_EVENT.EMAIL_VERIFIED,
				}),
				expect.any(Object),
			);
		});

		it("탈퇴한 사용자가 이메일 인증 시도 시 USER_0606 에러", async () => {
			// Given
			const deletedUser = UserBuilder.create()
				.withEmail(verifyInput.email)
				.verified()
				.deleted()
				.build();
			userRepo.findByEmail.mockResolvedValue(deletedUser);

			// When & Then
			await expect(service.verifyEmail(verifyInput)).rejects.toThrow(
				BusinessException,
			);
			expect(verificationService.verifyCode).not.toHaveBeenCalled();
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

		/**
		 * 로그인 성공 시나리오 mock 설정 헬퍼
		 */
		const setupSuccessfulLogin = (
			mockUser: ReturnType<typeof UserBuilder.prototype.build>,
		) => {
			loginAttemptRepo.countRecentFailuresByEmail.mockResolvedValue(0);
			userRepo.findByEmail.mockResolvedValue(mockUser);
			accountRepo.findByUserIdAndProvider.mockResolvedValue({
				id: "account-123",
				userId: mockUser.id,
				type: "CREDENTIAL",
				password: "hashed-password",
			} as unknown as Account);
			passwordService.verify.mockResolvedValue(true);
			database.$transaction.mockImplementation(
				async (callback: TransactionCallback) =>
					callback({} as TransactionClient),
			);
			sessionService.createSessionWithTokens.mockResolvedValue({
				sessionId: "session-id",
				tokens: mockTokens,
				tokenFamily: "family-id",
			});
			loginAttemptRepo.create.mockResolvedValue({} as LoginAttempt);
			securityLogRepo.create.mockResolvedValue({} as SecurityLog);
			userRepo.findByIdWithProfile.mockResolvedValue({
				...mockUser,
				profile: { name: "Test User", profileImage: null },
			} as never);
		};

		it("올바른 자격 증명으로 토큰을 반환한다", async () => {
			// Given - Builder로 인증 완료된 사용자 생성
			const mockUser = UserBuilder.create()
				.withId("user-123")
				.withEmail(loginInput.email)
				.verified()
				.build();

			setupSuccessfulLogin(mockUser);

			// When
			const result = await service.login(loginInput);

			// Then
			expect(result.userId).toBe(mockUser.id);
			expect(result.tokens).toEqual(mockTokens);
			expect(result.sessionId).toBe("session-id");
			expect(result.accountRestored).toBe(false);
		});

		it("존재하지 않는 이메일이면 에러를 던진다", async () => {
			// Given
			loginAttemptRepo.countRecentFailuresByEmail.mockResolvedValue(0);
			userRepo.findByEmail.mockResolvedValue(null);
			loginAttemptRepo.create.mockResolvedValue({} as LoginAttempt);

			// When & Then
			await expect(service.login(loginInput)).rejects.toThrow(
				BusinessException,
			);
			expect(loginAttemptRepo.create).toHaveBeenCalledWith(
				expect.objectContaining({ success: false }),
			);
		});

		it("잘못된 비밀번호면 에러를 던진다", async () => {
			// Given
			const mockUser = UserBuilder.create()
				.withEmail(loginInput.email)
				.verified()
				.build();

			loginAttemptRepo.countRecentFailuresByEmail.mockResolvedValue(0);
			userRepo.findByEmail.mockResolvedValue(mockUser);
			accountRepo.findByUserIdAndProvider.mockResolvedValue({
				id: "account-123",
				userId: mockUser.id,
				password: "hashed-password",
			} as unknown as Account);
			passwordService.verify.mockResolvedValue(false);
			loginAttemptRepo.create.mockResolvedValue({} as LoginAttempt);

			// When & Then
			await expect(service.login(loginInput)).rejects.toThrow(
				BusinessException,
			);
			expect(loginAttemptRepo.create).toHaveBeenCalledWith(
				expect.objectContaining({ success: false }),
			);
		});

		it("이메일 미인증 사용자면 에러를 던진다", async () => {
			// Given - Builder로 미인증 사용자 간단하게 생성
			const pendingUser = UserBuilder.create()
				.withEmail(loginInput.email)
				.withStatus("PENDING_VERIFY")
				.build();

			loginAttemptRepo.countRecentFailuresByEmail.mockResolvedValue(0);
			userRepo.findByEmail.mockResolvedValue(pendingUser);
			accountRepo.findByUserIdAndProvider.mockResolvedValue({
				id: "account-123",
				userId: pendingUser.id,
				password: "hashed-password",
			} as unknown as Account);
			passwordService.verify.mockResolvedValue(true);

			// When & Then
			await expect(service.login(loginInput)).rejects.toThrow(
				BusinessException,
			);
		});

		it("세션을 생성하고 보안 이벤트를 기록한다", async () => {
			// Given
			const mockUser = UserBuilder.create()
				.withId("user-123")
				.withEmail(loginInput.email)
				.verified()
				.build();

			setupSuccessfulLogin(mockUser);

			// When
			await service.login(loginInput);

			// Then
			expect(sessionService.createSessionWithTokens).toHaveBeenCalled();
			expect(securityLogRepo.create).toHaveBeenCalledWith(
				expect.objectContaining({
					userId: mockUser.id,
					event: SECURITY_EVENT.LOGIN_SUCCESS,
				}),
				expect.any(Object),
			);
		});

		it("로그인 시도를 기록한다", async () => {
			// Given
			const mockUser = UserBuilder.create()
				.withId("user-123")
				.withEmail(loginInput.email)
				.verified()
				.build();

			setupSuccessfulLogin(mockUser);

			// When
			await service.login(loginInput);

			// Then
			expect(loginAttemptRepo.create).toHaveBeenCalledWith(
				expect.objectContaining({
					email: loginInput.email,
					provider: "CREDENTIAL",
					success: true,
				}),
				expect.any(Object),
			);
		});

		it("로그인 시도 횟수 초과 시 에러를 던지고 ACCOUNT_LOCKED 보안 로그를 기록한다", async () => {
			// Given
			loginAttemptRepo.countRecentFailuresByEmail.mockResolvedValue(
				LOGIN_ATTEMPT.MAX_FAILURES,
			);

			// When & Then
			await expect(service.login(loginInput)).rejects.toThrow(
				BusinessException,
			);
			expect(securityLogRepo.create).toHaveBeenCalledWith(
				expect.objectContaining({
					event: SECURITY_EVENT.ACCOUNT_LOCKED,
					metadata: expect.objectContaining({
						email: loginInput.email,
						recentFailures: LOGIN_ATTEMPT.MAX_FAILURES,
					}),
				}),
			);
		});

		it("계정이 잠긴 상태면 에러를 던진다", async () => {
			// Given - Builder로 잠긴 계정 생성
			const lockedUser = UserBuilder.create()
				.withEmail(loginInput.email)
				.locked()
				.build();

			loginAttemptRepo.countRecentFailuresByEmail.mockResolvedValue(0);
			userRepo.findByEmail.mockResolvedValue(lockedUser);
			accountRepo.findByUserIdAndProvider.mockResolvedValue({
				id: "account-123",
				userId: lockedUser.id,
				password: "hashed-password",
			} as unknown as Account);
			passwordService.verify.mockResolvedValue(true);

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

		it("현재 세션을 비활성화한다", async () => {
			// Given - Builder로 세션 생성
			const mockSession = SessionBuilder.create(userId)
				.withId(sessionId)
				.build();

			sessionRepo.findById.mockResolvedValue(mockSession);
			sessionRepo.revoke.mockResolvedValue({} as Session);
			securityLogRepo.create.mockResolvedValue({} as SecurityLog);
			cacheService.invalidateSession.mockResolvedValue(undefined);

			// When
			const result = await service.logout(userId, sessionId);

			// Then
			expect(sessionRepo.revoke).toHaveBeenCalledWith(
				sessionId,
				REVOKE_REASON.USER_LOGOUT,
			);
			expect(result.message).toContain("로그아웃");
		});

		it("보안 이벤트를 기록한다", async () => {
			// Given
			const mockSession = SessionBuilder.create(userId)
				.withId(sessionId)
				.build();

			sessionRepo.findById.mockResolvedValue(mockSession);
			sessionRepo.revoke.mockResolvedValue({} as Session);
			securityLogRepo.create.mockResolvedValue({} as SecurityLog);
			cacheService.invalidateSession.mockResolvedValue(undefined);

			// When
			await service.logout(userId, sessionId);

			// Then
			expect(securityLogRepo.create).toHaveBeenCalledWith(
				expect.objectContaining({
					userId,
					event: SECURITY_EVENT.LOGOUT,
				}),
			);
		});

		it("존재하지 않는 세션이면 에러를 던진다", async () => {
			// Given
			sessionRepo.findById.mockResolvedValue(null);

			// When & Then
			await expect(service.logout(userId, sessionId)).rejects.toThrow(
				BusinessException,
			);
		});

		it("이미 폐기된 세션이면 에러를 던진다", async () => {
			// Given - Builder로 폐기된 세션 생성
			const revokedSession = SessionBuilder.create(userId)
				.withId(sessionId)
				.revoked()
				.build();

			sessionRepo.findById.mockResolvedValue(revokedSession);

			// When & Then
			await expect(service.logout(userId, sessionId)).rejects.toThrow(
				BusinessException,
			);
		});

		it("다른 사용자의 세션이면 에러를 던진다", async () => {
			// Given
			const otherUserSession = SessionBuilder.create("other-user")
				.withId(sessionId)
				.build();

			sessionRepo.findById.mockResolvedValue(otherUserSession);

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

		it("사용자의 모든 세션을 비활성화한다", async () => {
			// Given
			const mockSessions = [
				SessionBuilder.create(userId).withId("session-1").build(),
				SessionBuilder.create(userId).withId("session-2").build(),
				SessionBuilder.create(userId).withId("session-3").build(),
			];
			sessionRepo.findActiveByUserId.mockResolvedValue(mockSessions);
			sessionRepo.revokeAllByUserId.mockResolvedValue(3);
			securityLogRepo.create.mockResolvedValue({} as SecurityLog);

			// When
			const result = await service.logoutAll(userId);

			// Then
			expect(sessionRepo.revokeAllByUserId).toHaveBeenCalledWith(
				userId,
				REVOKE_REASON.USER_LOGOUT_ALL,
			);
			expect(result.revokedCount).toBe(3);
		});

		it("모든 활성 세션의 캐시를 즉시 무효화한다", async () => {
			// Given
			const mockSessions = [
				SessionBuilder.create(userId).withId("session-1").build(),
				SessionBuilder.create(userId).withId("session-2").build(),
			];
			sessionRepo.findActiveByUserId.mockResolvedValue(mockSessions);
			sessionRepo.revokeAllByUserId.mockResolvedValue(2);
			securityLogRepo.create.mockResolvedValue({} as SecurityLog);

			// When
			await service.logoutAll(userId);

			// Then
			expect(cacheService.invalidateSession).toHaveBeenCalledWith("session-1");
			expect(cacheService.invalidateSession).toHaveBeenCalledWith("session-2");
			expect(cacheService.invalidateSession).toHaveBeenCalledTimes(2);
		});

		it("보안 이벤트를 기록한다", async () => {
			// Given
			sessionRepo.findActiveByUserId.mockResolvedValue([]);
			sessionRepo.revokeAllByUserId.mockResolvedValue(3);
			securityLogRepo.create.mockResolvedValue({} as SecurityLog);

			// When
			await service.logoutAll(userId);

			// Then
			expect(securityLogRepo.create).toHaveBeenCalledWith(
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
			role: "USER",
			type: "refresh" as const,
		};

		const mockNewTokens = {
			accessToken: "new-access-token",
			refreshToken: "new-refresh-token",
			expiresIn: 900,
		};

		it("유효한 리프레시 토큰으로 새 토큰 쌍을 발급한다", async () => {
			// Given
			const mockSession = SessionBuilder.create(userId)
				.withId(sessionId)
				.withTokenVersion(1)
				.withTokenFamily("family-id")
				.build();

			tokenService.verifyRefreshToken.mockResolvedValue(
				mockPayload as JwtPayload,
			);
			tokenService.hashRefreshToken.mockReturnValue("hashed-token");
			sessionRepo.findByRefreshTokenHash.mockResolvedValue(mockSession);
			sessionRepo.findByPreviousTokenHash.mockResolvedValue(null);
			tokenService.generateTokenPair.mockResolvedValue(mockNewTokens);
			sessionRepo.rotateToken.mockResolvedValue({
				...mockSession,
				tokenVersion: 2,
			} as Session);
			securityLogRepo.create.mockResolvedValue({} as SecurityLog);

			// When
			const result = await service.refreshTokens(refreshToken);

			// Then
			expect(result.tokens).toEqual(mockNewTokens);
			expect(result.sessionId).toBe(sessionId);
		});

		it("토큰 로테이션을 수행한다", async () => {
			// Given
			const mockSession = SessionBuilder.create(userId)
				.withId(sessionId)
				.withTokenVersion(1)
				.withTokenFamily("family-id")
				.build();

			tokenService.verifyRefreshToken.mockResolvedValue(
				mockPayload as JwtPayload,
			);
			tokenService.hashRefreshToken.mockReturnValue("hashed-token");
			sessionRepo.findByRefreshTokenHash.mockResolvedValue(mockSession);
			sessionRepo.findByPreviousTokenHash.mockResolvedValue(null);
			tokenService.generateTokenPair.mockResolvedValue(mockNewTokens);
			sessionRepo.rotateToken.mockResolvedValue({
				...mockSession,
				tokenVersion: 2,
			} as Session);
			securityLogRepo.create.mockResolvedValue({} as SecurityLog);

			// When
			await service.refreshTokens(refreshToken);

			// Then
			expect(sessionRepo.rotateToken).toHaveBeenCalledWith(
				sessionId,
				expect.objectContaining({
					tokenVersion: 2,
					expectedTokenVersion: 1,
				}),
			);
		});

		it("유효하지 않은 리프레시 토큰이면 에러를 던진다", async () => {
			// Given
			tokenService.verifyRefreshToken.mockResolvedValue(null);

			// When & Then
			await expect(service.refreshTokens(refreshToken)).rejects.toThrow(
				BusinessException,
			);
		});

		it("토큰 재사용이 감지되면 토큰 패밀리를 폐기한다", async () => {
			// Given
			const mockSession = SessionBuilder.create(userId)
				.withId(sessionId)
				.withTokenFamily("family-id")
				.build();

			tokenService.verifyRefreshToken.mockResolvedValue(
				mockPayload as JwtPayload,
			);
			tokenService.hashRefreshToken.mockReturnValue("hashed-token");
			sessionRepo.findByRefreshTokenHash.mockResolvedValue(null);
			sessionRepo.findByPreviousTokenHash.mockResolvedValue(mockSession);
			sessionRepo.revokeByTokenFamily.mockResolvedValue(1);
			securityLogRepo.create.mockResolvedValue({} as SecurityLog);

			// When & Then
			await expect(service.refreshTokens(refreshToken)).rejects.toThrow(
				BusinessException,
			);

			expect(sessionRepo.revokeByTokenFamily).toHaveBeenCalledWith(
				mockSession.tokenFamily,
				REVOKE_REASON.TOKEN_REUSE_DETECTED,
			);

			expect(securityLogRepo.create).toHaveBeenCalledWith(
				expect.objectContaining({
					event: SECURITY_EVENT.SUSPICIOUS_ACTIVITY,
				}),
			);
		});

		it("폐기된 세션이면 에러를 던진다", async () => {
			// Given
			const revokedSession = SessionBuilder.create(userId)
				.withId(sessionId)
				.revoked()
				.build();

			tokenService.verifyRefreshToken.mockResolvedValue(
				mockPayload as JwtPayload,
			);
			tokenService.hashRefreshToken.mockReturnValue("hashed-token");
			sessionRepo.findByRefreshTokenHash.mockResolvedValue(revokedSession);
			sessionService.assertSessionValid.mockImplementation(() => {
				throw BusinessExceptions.sessionRevoked();
			});

			// When & Then
			await expect(service.refreshTokens(refreshToken)).rejects.toThrow(
				BusinessException,
			);
		});

		it("만료된 세션이면 에러를 던진다", async () => {
			// Given
			const expiredSession = SessionBuilder.create(userId)
				.withId(sessionId)
				.expired()
				.build();

			tokenService.verifyRefreshToken.mockResolvedValue(
				mockPayload as JwtPayload,
			);
			tokenService.hashRefreshToken.mockReturnValue("hashed-token");
			sessionRepo.findByRefreshTokenHash.mockResolvedValue(expiredSession);
			sessionService.assertSessionValid.mockImplementation(() => {
				throw BusinessExceptions.sessionExpired();
			});

			// When & Then
			await expect(service.refreshTokens(refreshToken)).rejects.toThrow(
				BusinessException,
			);
		});

		it("토큰 로테이션 실패 시 에러를 던진다", async () => {
			// Given
			const mockSession = SessionBuilder.create(userId)
				.withId(sessionId)
				.withTokenVersion(1)
				.withTokenFamily("family-id")
				.build();

			tokenService.verifyRefreshToken.mockResolvedValue(
				mockPayload as JwtPayload,
			);
			tokenService.hashRefreshToken.mockReturnValue("hashed-token");
			sessionRepo.findByRefreshTokenHash.mockResolvedValue(mockSession);
			sessionRepo.findByPreviousTokenHash.mockResolvedValue(null);
			tokenService.generateTokenPair.mockResolvedValue(mockNewTokens);
			sessionRepo.rotateToken.mockResolvedValue(null);

			// When & Then
			await expect(service.refreshTokens(refreshToken)).rejects.toThrow(
				BusinessException,
			);
		});
	});

	// ============================================
	// deleteAccount
	// ============================================

	describe("deleteAccount", () => {
		const userId = "user-123";
		const sessionId = "session-123";
		const metadata = { ip: "127.0.0.1", userAgent: "test-agent" };

		it("CREDENTIAL 계정: 비밀번호 확인 후 soft delete 처리", async () => {
			// Given
			const user = UserBuilder.create().withId(userId).verified().build();
			userRepo.findById.mockResolvedValue(user);
			accountRepo.findAllByUserId.mockResolvedValue([
				{
					id: 1,
					userId,
					provider: "CREDENTIAL" as AccountProvider,
					password: "hashed-pw",
				},
			] as Account[]);
			passwordService.verify.mockResolvedValue(true);
			sessionRepo.findActiveByUserId.mockResolvedValue([
				SessionBuilder.create(userId).withId(sessionId).build(),
			]);
			database.$transaction.mockImplementation(
				async (callback: TransactionCallback) =>
					callback({} as TransactionClient),
			);
			userRepo.softDelete.mockResolvedValue({} as User);
			sessionRepo.revokeAllByUserId.mockResolvedValue(1);
			securityLogRepo.create.mockResolvedValue({} as SecurityLog);

			// When
			const result = await service.deleteAccount(
				userId,
				sessionId,
				{ password: "CurrentPw123" },
				metadata,
			);

			// Then
			expect(result.message).toContain("탈퇴 처리되었습니다");
			expect(result.gracePeriodDays).toBe(30);
			expect(userRepo.softDelete).toHaveBeenCalledWith(
				userId,
				expect.any(Object),
			);
			expect(sessionRepo.revokeAllByUserId).toHaveBeenCalledWith(
				userId,
				REVOKE_REASON.ACCOUNT_DELETION,
				undefined,
				expect.any(Object),
			);
		});

		it("CREDENTIAL 계정: 비밀번호 미입력 시 USER_0612 에러", async () => {
			// Given
			const user = UserBuilder.create().withId(userId).verified().build();
			userRepo.findById.mockResolvedValue(user);
			accountRepo.findAllByUserId.mockResolvedValue([
				{
					id: 1,
					userId,
					provider: "CREDENTIAL" as AccountProvider,
					password: "hashed-pw",
				},
			] as Account[]);

			// When & Then
			await expect(
				service.deleteAccount(userId, sessionId, {}, metadata),
			).rejects.toThrow(BusinessException);
		});

		it("CREDENTIAL 계정: 비밀번호 불일치 시 USER_0602 에러", async () => {
			// Given
			const user = UserBuilder.create().withId(userId).verified().build();
			userRepo.findById.mockResolvedValue(user);
			accountRepo.findAllByUserId.mockResolvedValue([
				{
					id: 1,
					userId,
					provider: "CREDENTIAL" as AccountProvider,
					password: "hashed-pw",
				},
			] as Account[]);
			passwordService.verify.mockResolvedValue(false);

			// When & Then
			await expect(
				service.deleteAccount(
					userId,
					sessionId,
					{ password: "WrongPassword123" },
					metadata,
				),
			).rejects.toThrow(BusinessException);
		});

		it("소셜 전용 계정: 세션 기반 확인으로 soft delete 처리", async () => {
			// Given
			const user = UserBuilder.create().withId(userId).verified().build();
			userRepo.findById.mockResolvedValue(user);
			accountRepo.findAllByUserId.mockResolvedValue([
				{
					id: 1,
					userId,
					provider: "GOOGLE" as AccountProvider,
					password: null,
				},
			] as Account[]);
			sessionRepo.findActiveByUserId.mockResolvedValue([
				SessionBuilder.create(userId).withId(sessionId).build(),
			]);
			database.$transaction.mockImplementation(
				async (callback: TransactionCallback) =>
					callback({} as TransactionClient),
			);
			userRepo.softDelete.mockResolvedValue({} as User);
			sessionRepo.revokeAllByUserId.mockResolvedValue(1);
			securityLogRepo.create.mockResolvedValue({} as SecurityLog);

			// When
			const result = await service.deleteAccount(
				userId,
				sessionId,
				{},
				metadata,
			);

			// Then
			expect(result.message).toContain("탈퇴 처리되었습니다");
			expect(passwordService.verify).not.toHaveBeenCalled();
		});

		it("이미 탈퇴한 계정 시도 시 USER_0606 에러", async () => {
			// Given
			const user = UserBuilder.create()
				.withId(userId)
				.verified()
				.deleted()
				.build();
			userRepo.findById.mockResolvedValue(user);

			// When & Then
			await expect(
				service.deleteAccount(userId, sessionId, {}, metadata),
			).rejects.toThrow(BusinessException);
		});

		it("존재하지 않는 사용자 시 USER_0601 에러", async () => {
			// Given
			userRepo.findById.mockResolvedValue(null);

			// When & Then
			await expect(
				service.deleteAccount(userId, sessionId, {}, metadata),
			).rejects.toThrow(BusinessException);
		});

		it("트랜잭션 내 softDelete + revokeAllByUserId + securityLog 호출 확인", async () => {
			// Given
			const user = UserBuilder.create().withId(userId).verified().build();
			userRepo.findById.mockResolvedValue(user);
			accountRepo.findAllByUserId.mockResolvedValue([
				{
					id: 1,
					userId,
					provider: "GOOGLE" as AccountProvider,
					password: null,
				},
			] as Account[]);
			sessionRepo.findActiveByUserId.mockResolvedValue([
				SessionBuilder.create(userId).withId(sessionId).build(),
			]);
			database.$transaction.mockImplementation(
				async (callback: TransactionCallback) =>
					callback({} as TransactionClient),
			);
			userRepo.softDelete.mockResolvedValue({} as User);
			sessionRepo.revokeAllByUserId.mockResolvedValue(1);
			securityLogRepo.create.mockResolvedValue({} as SecurityLog);

			// When
			await service.deleteAccount(userId, sessionId, {}, metadata);

			// Then
			expect(database.$transaction).toHaveBeenCalled();
			expect(securityLogRepo.create).toHaveBeenCalledWith(
				expect.objectContaining({
					userId,
					event: SECURITY_EVENT.ACCOUNT_DELETION_REQUESTED,
				}),
				expect.any(Object),
			);
		});
	});

	// ============================================
	// login - 탈퇴 사용자 차단
	// ============================================

	describe("login - 탈퇴 사용자", () => {
		it("유예 기간 초과 시 USER_0606 에러", async () => {
			// Given - 31일 전에 탈퇴한 사용자
			const deletedUser = UserBuilder.create()
				.withEmail("deleted@example.com")
				.verified()
				.deleted(new Date(Date.now() - 31 * 24 * 60 * 60 * 1000))
				.build();
			userRepo.findByEmail.mockResolvedValue(deletedUser);
			accountRepo.findByUserIdAndProvider.mockResolvedValue({
				id: 1,
				userId: deletedUser.id,
				provider: "CREDENTIAL",
				password: "hashed-pw",
			} as unknown as Account);
			passwordService.verify.mockResolvedValue(true);
			loginAttemptRepo.countRecentFailuresByEmail.mockResolvedValue(0);

			// When & Then
			await expect(
				service.login({
					email: "deleted@example.com",
					password: "Password123",
				}),
			).rejects.toThrow(BusinessException);
		});

		it("유예 기간 내 탈퇴 사용자 로그인 시 자동 복구", async () => {
			// Given - 29일 전에 탈퇴한 사용자
			const deletedAt = new Date(Date.now() - 29 * 24 * 60 * 60 * 1000);
			const deletedUser = UserBuilder.create()
				.withEmail("deleted@example.com")
				.verified()
				.deleted(deletedAt)
				.build();
			userRepo.findByEmail.mockResolvedValue(deletedUser);
			accountRepo.findByUserIdAndProvider.mockResolvedValue({
				id: 1,
				userId: deletedUser.id,
				provider: "CREDENTIAL",
				password: "hashed-pw",
			} as unknown as Account);
			passwordService.verify.mockResolvedValue(true);
			loginAttemptRepo.countRecentFailuresByEmail.mockResolvedValue(0);
			database.$transaction.mockImplementation(
				async (callback: TransactionCallback) =>
					callback({} as TransactionClient),
			);
			sessionService.createSessionWithTokens.mockResolvedValue({
				sessionId: "session-123",
				tokens: {
					accessToken: "access",
					refreshToken: "refresh",
					expiresIn: 900,
				},
				tokenFamily: "family-123",
			});
			userRepo.findByIdWithProfile.mockResolvedValue({
				id: deletedUser.id,
				profile: { name: "Test", profileImage: null },
			} as never);

			// When
			const result = await service.login({
				email: "deleted@example.com",
				password: "Password123",
			});

			// Then - 로그인 성공 + accountRestored 플래그
			expect(result.tokens).toBeDefined();
			expect(result.userId).toBe(deletedUser.id);
			expect(result.accountRestored).toBe(true);

			// 복구 호출 확인
			expect(userRepo.restore).toHaveBeenCalledWith(
				deletedUser.id,
				expect.anything(),
			);
			// ACCOUNT_RESTORED 보안 로그 확인
			expect(securityLogRepo.create).toHaveBeenCalledWith(
				expect.objectContaining({
					event: "ACCOUNT_RESTORED",
					userId: deletedUser.id,
				}),
				expect.anything(),
			);
			// 캐시 무효화 확인
			expect(cacheService.invalidateUserProfile).toHaveBeenCalledWith(
				deletedUser.id,
			);
		});
	});

	// ============================================
	// getActiveSessions
	// ============================================

	describe("getActiveSessions", () => {
		const userId = "user-123";

		it("사용자의 활성 세션 목록을 반환한다", async () => {
			// Given
			const mockSessions = [
				SessionBuilder.create(userId).withId("session-1").build(),
				SessionBuilder.create(userId).withId("session-2").build(),
			];

			sessionRepo.findActiveByUserId.mockResolvedValue(mockSessions);

			// When
			const result = await service.getActiveSessions(userId);

			// Then
			expect(result).toHaveLength(2);
			expect(result[0]?.id).toBe("session-1");
			expect(result[1]?.id).toBe("session-2");
		});

		it("세션 정보를 올바르게 매핑한다", async () => {
			// Given
			const mockSession = SessionBuilder.create(userId)
				.withId("session-1")
				.withDeviceInfo("Chrome/120", "192.168.1.1")
				.build();

			sessionRepo.findActiveByUserId.mockResolvedValue([mockSession]);

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

		it("특정 세션을 폐기한다", async () => {
			// Given
			const mockSession = SessionBuilder.create(userId)
				.withId(sessionId)
				.build();

			sessionRepo.findById.mockResolvedValue(mockSession);
			sessionRepo.revoke.mockResolvedValue({} as Session);
			cacheService.invalidateSession.mockResolvedValue(undefined);
			securityLogRepo.create.mockResolvedValue({} as SecurityLog);

			// When
			const result = await service.revokeSession(userId, sessionId);

			// Then
			expect(sessionRepo.revoke).toHaveBeenCalledWith(
				sessionId,
				REVOKE_REASON.USER_REVOKE,
			);
			expect(result.message).toContain("세션이 종료되었습니다");
		});

		it("보안 로그를 기록한다", async () => {
			// Given
			const mockSession = SessionBuilder.create(userId)
				.withId(sessionId)
				.build();

			sessionRepo.findById.mockResolvedValue(mockSession);
			sessionRepo.revoke.mockResolvedValue({} as Session);
			cacheService.invalidateSession.mockResolvedValue(undefined);
			securityLogRepo.create.mockResolvedValue({} as SecurityLog);

			// When
			await service.revokeSession(userId, sessionId);

			// Then
			expect(securityLogRepo.create).toHaveBeenCalledWith(
				expect.objectContaining({
					userId,
					event: SECURITY_EVENT.SESSION_REVOKED,
					metadata: { revokedSessionId: sessionId },
				}),
			);
		});

		it("존재하지 않는 세션이면 에러를 던진다", async () => {
			// Given
			sessionRepo.findById.mockResolvedValue(null);

			// When & Then
			await expect(service.revokeSession(userId, sessionId)).rejects.toThrow(
				BusinessException,
			);
		});

		it("다른 사용자의 세션이면 에러를 던진다", async () => {
			// Given
			const otherUserSession = SessionBuilder.create("other-user")
				.withId(sessionId)
				.build();

			sessionRepo.findById.mockResolvedValue(otherUserSession);

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

		it("인증 코드를 재발송한다", async () => {
			// Given
			const mockUser = UserBuilder.create()
				.withId("user-123")
				.withEmail(email)
				.withStatus("PENDING_VERIFY")
				.build();

			userRepo.findByEmail.mockResolvedValue(mockUser);
			database.$transaction.mockImplementation(
				async (callback: TransactionCallback) =>
					callback({} as TransactionClient),
			);
			verificationService.createEmailVerification.mockResolvedValue({
				code: "123456",
				expiresAt: new Date(),
			});
			verificationService.sendVerificationEmail.mockResolvedValue(undefined);

			// When
			const result = await service.resendVerification(email);

			// Then
			expect(verificationService.createEmailVerification).toHaveBeenCalled();
			expect(verificationService.sendVerificationEmail).toHaveBeenCalledWith(
				email,
				expect.any(String),
			);
			expect(result.message).toBeDefined();
		});

		it("존재하지 않는 이메일도 동일한 응답을 반환한다 (보안)", async () => {
			// Given
			userRepo.findByEmail.mockResolvedValue(null);

			// When
			const result = await service.resendVerification(email);

			// Then
			expect(result.message).toBeDefined();
		});

		it("이미 인증된 사용자면 에러를 던진다", async () => {
			// Given
			const verifiedUser = UserBuilder.create()
				.withEmail(email)
				.verified()
				.build();

			userRepo.findByEmail.mockResolvedValue(verifiedUser);

			// When & Then
			await expect(service.resendVerification(email)).rejects.toThrow(
				BusinessException,
			);
		});

		it("이메일 전송 실패해도 재전송 요청은 성공한다", async () => {
			// Given
			const mockUser = UserBuilder.create()
				.withId("user-123")
				.withEmail(email)
				.withStatus("PENDING_VERIFY")
				.build();

			userRepo.findByEmail.mockResolvedValue(mockUser);
			database.$transaction.mockImplementation(
				async (callback: TransactionCallback) =>
					callback({} as TransactionClient),
			);
			verificationService.createEmailVerification.mockResolvedValue({
				code: "654321",
				expiresAt: new Date(),
			});
			verificationService.sendVerificationEmail.mockRejectedValue(
				new Error("Email service unavailable"),
			);

			// When
			const result = await service.resendVerification(email);

			// Then
			expect(result.message).toBeDefined();
		});
	});

	// ============================================
	// getCurrentUser (캐싱)
	// ============================================

	describe("getCurrentUser", () => {
		it("캐시된 프로필을 조회하여 사용자 정보를 반환한다", async () => {
			// Given
			const mockUser = UserBuilder.create()
				.withId("user-123")
				.withEmail("test@example.com")
				.verified()
				.build();

			const cachedProfile = {
				id: mockUser.id,
				email: mockUser.email,
				userTag: mockUser.userTag,
				role: mockUser.role,
				status: mockUser.status,
				emailVerifiedAt: mockUser.emailVerifiedAt?.toISOString() ?? null,
				subscriptionStatus: mockUser.subscriptionStatus,
				subscriptionExpiresAt: null,
				name: "Test User",
				profileImage: null,
				createdAt: mockUser.createdAt.toISOString(),
				providers: ["CREDENTIAL"] as AccountProvider[],
			};
			cacheService.wrapUserProfile.mockResolvedValue(cachedProfile);

			// When
			const result = await service.getCurrentUser(
				mockUser.id,
				mockUser.email,
				"session-123",
			);

			// Then
			expect(result.userId).toBe(mockUser.id);
			expect(result.email).toBe(mockUser.email);
			expect(result.name).toBe("Test User");
			expect(result.providers).toEqual(["CREDENTIAL"]);
		});

		it("사용자가 존재하지 않으면 에러를 던진다", async () => {
			// Given
			cacheService.wrapUserProfile.mockResolvedValue(undefined);

			// When & Then
			await expect(
				service.getCurrentUser("user-123", "test@example.com", "session-123"),
			).rejects.toThrow(BusinessException);
		});

		it("다중 provider (CREDENTIAL + GOOGLE) 목록을 반환한다", async () => {
			// Given
			const mockUser = UserBuilder.create()
				.withId("user-123")
				.withEmail("multi@example.com")
				.verified()
				.build();

			const cachedProfile = {
				id: mockUser.id,
				email: mockUser.email,
				userTag: mockUser.userTag,
				role: mockUser.role,
				status: mockUser.status,
				emailVerifiedAt: mockUser.emailVerifiedAt?.toISOString() ?? null,
				subscriptionStatus: mockUser.subscriptionStatus,
				subscriptionExpiresAt: null,
				name: "Multi Provider User",
				profileImage: null,
				createdAt: mockUser.createdAt.toISOString(),
				providers: ["CREDENTIAL", "GOOGLE"] as AccountProvider[],
			};
			cacheService.wrapUserProfile.mockResolvedValue(cachedProfile);

			// When
			const result = await service.getCurrentUser(
				mockUser.id,
				mockUser.email,
				"session-123",
			);

			// Then
			expect(result.providers).toEqual(["CREDENTIAL", "GOOGLE"]);
			expect(result.providers).toHaveLength(2);
		});

		it("sessionId는 캐시되지 않고 항상 파라미터 값을 사용한다", async () => {
			// Given
			const mockUser = UserBuilder.create()
				.withId("user-123")
				.withEmail("test@example.com")
				.verified()
				.build();

			const cachedProfile = {
				id: mockUser.id,
				email: mockUser.email,
				userTag: mockUser.userTag,
				role: mockUser.role,
				status: mockUser.status,
				emailVerifiedAt: mockUser.emailVerifiedAt?.toISOString() ?? null,
				subscriptionStatus: mockUser.subscriptionStatus,
				subscriptionExpiresAt: null,
				name: "Test User",
				profileImage: null,
				createdAt: mockUser.createdAt.toISOString(),
				providers: ["CREDENTIAL"] as AccountProvider[],
			};
			cacheService.wrapUserProfile.mockResolvedValue(cachedProfile);

			// When
			const result = await service.getCurrentUser(
				mockUser.id,
				mockUser.email,
				"different-session-456",
			);

			// Then
			expect(result.sessionId).toBe("different-session-456");
		});
	});

	// ============================================
	// updateProfile (캐시 무효화)
	// ============================================

	describe("updateProfile", () => {
		const userId = "user-123";
		const updateData = { name: "Updated Name" };

		it("프로필을 업데이트하고 캐시를 무효화한다", async () => {
			// Given
			userRepo.updateProfile.mockResolvedValue({
				name: "Updated Name",
				profileImage: null,
			} as never);
			cacheService.invalidateUserProfile.mockResolvedValue(undefined);

			// When
			const result = await service.updateProfile(userId, updateData);

			// Then
			expect(result.message).toContain("프로필이 수정되었습니다");
			expect(result.name).toBe("Updated Name");
			expect(cacheService.invalidateUserProfile).toHaveBeenCalledWith(userId);
		});

		it("프로필 업데이트 후 캐시 무효화가 호출된다", async () => {
			// Given
			userRepo.updateProfile.mockResolvedValue({
				name: "Updated Name",
				profileImage: null,
			} as never);
			cacheService.invalidateUserProfile.mockResolvedValue(undefined);

			// When
			await service.updateProfile(userId, updateData);

			// Then - 호출 순서 검증
			const updateCallOrder =
				userRepo.updateProfile.mock.invocationCallOrder[0];
			const invalidateCallOrder =
				cacheService.invalidateUserProfile.mock.invocationCallOrder[0];
			expect(invalidateCallOrder).toBeGreaterThan(updateCallOrder as number);
		});

		it("프로필 이미지를 URL로 업데이트할 수 있다", async () => {
			// Given
			const imageUpdateData = {
				profileImage: "https://example.com/new-image.jpg",
			};
			userRepo.updateProfile.mockResolvedValue({
				name: "Test User",
				profileImage: "https://example.com/new-image.jpg",
			} as never);
			cacheService.invalidateUserProfile.mockResolvedValue(undefined);

			// When
			const result = await service.updateProfile(userId, imageUpdateData);

			// Then
			expect(result.profileImage).toBe("https://example.com/new-image.jpg");
		});

		it("프로필 이미지를 아이콘 키로 업데이트할 수 있다", async () => {
			// Given
			const iconKeyUpdateData = {
				profileImage: "scottish_fold",
			};
			userRepo.updateProfile.mockResolvedValue({
				name: "Test User",
				profileImage: "scottish_fold",
			} as never);
			cacheService.invalidateUserProfile.mockResolvedValue(undefined);

			// When
			const result = await service.updateProfile(userId, iconKeyUpdateData);

			// Then
			expect(result.profileImage).toBe("scottish_fold");
		});
	});
});
