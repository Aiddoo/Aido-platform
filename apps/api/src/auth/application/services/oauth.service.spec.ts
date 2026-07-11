/**
 * OAuthService 테스트 (Suites 패턴)
 *
 * NestJS 공식 권장 Suites 라이브러리 사용
 * - 자동 Mock 생성으로 보일러플레이트 제거
 * - Builder 패턴으로 테스트 데이터 생성
 * - Given/When/Then 주석으로 테스트 구조화
 *
 * @see https://docs.nestjs.com/recipes/suites
 */

import { ErrorCode } from "@aido/errors";
import { Logger } from "@nestjs/common";
import type { Mocked } from "@suites/doubles.jest";
import { TestBed } from "@suites/unit";
import { AccountBuilder, UserBuilder } from "@test/builders";
import { asDep, asMock, mockOf } from "@test/mocks";
import { AdminNotificationFacade } from "@/admin-notification";
import {
	OAUTH_IDENTITY_PROVIDER_REGISTRY,
	type OAuthIdentityProvider,
	type OAuthIdentityProviderRegistry,
} from "@/auth/application/ports/oauth-identity-provider.port";
import {
	LOGIN_FAILURE_REASON,
	SECURITY_EVENT,
} from "@/auth/domain/constants/auth.constants";
import {
	AppleOAuthProvider,
	GoogleOAuthProvider,
	KakaoOAuthProvider,
	NaverOAuthProvider,
} from "@/auth/infrastructure/oauth/adapters";
import { OAuthTokenVerifierService } from "@/auth/infrastructure/oauth/verifier/oauth-token-verifier.service";
import { AccountRepository } from "@/auth/infrastructure/persistence/account.repository";
import { LoginAttemptRepository } from "@/auth/infrastructure/persistence/login-attempt.repository";
import { OAuthStateRepository } from "@/auth/infrastructure/persistence/oauth-state.repository";
import { SecurityLogRepository } from "@/auth/infrastructure/persistence/security-log.repository";
import { UserRepository } from "@/auth/infrastructure/persistence/user.repository";
import { type AccountProvider, Prisma } from "@/generated/prisma/client";
import { UNIT_OF_WORK, type UnitOfWorkPort } from "@/shared/application/ports";
import { ApplicationException } from "@/shared/domain/exceptions/application.exception";
import { DomainException } from "@/shared/domain/exceptions/domain.exception";
import { CacheService } from "@/shared/infrastructure/cache/cache.service";
import { TypedConfigService } from "@/shared/infrastructure/config/services/config.service";
import type { UserProvisioningSeederPort } from "../ports/user-provisioning-seeder.port";
import { IssueLoginUseCase } from "../use-cases/issue-login/issue-login.use-case";
import { ProvisionUserUseCase } from "../use-cases/provision-user/provision-user.use-case";
import { OAuthService } from "./oauth.service";
import { SessionService } from "./session.service";

/** Apple 토큰 검증 결과 프로필 */
interface AppleVerifiedProfile {
	id: string;
	email: string | null;
	emailVerified: boolean;
}

/** OAuth 프로필 (Google/Kakao/Naver) */
interface OAuthProfile {
	id: string;
	email: string | null;
	emailVerified: boolean;
	name?: string;
	picture?: string;
}

describe("OAuthService — OAuth 인증 서비스", () => {
	let service: OAuthService;
	let uow: Mocked<UnitOfWorkPort>;
	let userRepo: Mocked<UserRepository>;
	let accountRepo: Mocked<AccountRepository>;
	let securityLogRepo: Mocked<SecurityLogRepository>;
	let loginAttemptRepo: Mocked<LoginAttemptRepository>;
	let oauthStateRepo: Mocked<OAuthStateRepository>;
	let sessionService: jest.Mocked<SessionService>;
	let tokenVerifier: jest.Mocked<OAuthTokenVerifierService>;
	let configService: Mocked<TypedConfigService>;
	let adminNotificationFacade: Mocked<AdminNotificationFacade>;
	let cacheService: Mocked<CacheService>;

	// 재사용 가능한 테스트 데이터
	const mockTokens = {
		accessToken: "access-token",
		refreshToken: "refresh-token",
		expiresIn: 900,
	};

	const mockMetadata = {
		ip: "192.168.1.1",
		userAgent: "Test-User-Agent/1.0",
	};

	beforeEach(async () => {
		// Suites가 모든 의존성을 자동으로 mock
		const { unit, unitRef } = await TestBed.solitary(OAuthService).compile();

		service = unit;
		uow = unitRef.get(UNIT_OF_WORK);
		userRepo = unitRef.get(UserRepository);
		accountRepo = unitRef.get(AccountRepository);
		securityLogRepo = unitRef.get(SecurityLogRepository);
		loginAttemptRepo = unitRef.get(LoginAttemptRepository);
		oauthStateRepo = unitRef.get(OAuthStateRepository);
		// SessionService는 OAuthService 직접 의존이 아니라 IssueLoginUseCase의 의존이므로
		// 발급 수렴 유스케이스에 배선할 독립 mock으로 구성한다
		sessionService = mockOf<SessionService>({
			createSessionWithTokens: jest.fn(),
		});
		configService = unitRef.get(TypedConfigService);
		adminNotificationFacade = unitRef.get(AdminNotificationFacade);
		cacheService = unitRef.get(CacheService);

		// IssueLoginUseCase(발급 수렴)를 실제 인스턴스로 위임 — 소셜 로그인 테스트가
		// 세션·로그인시도·보안로그·프로필 조회 호출을 그대로 검증하도록 mock 콜라보레이터에 배선
		const issueLogin = unitRef.get(IssueLoginUseCase);
		const realIssueLogin = new IssueLoginUseCase(
			asDep(sessionService),
			asDep(loginAttemptRepo),
			asDep(securityLogRepo),
			asDep(userRepo),
		);
		issueLogin.execute.mockImplementation((input) =>
			realIssueLogin.execute(input),
		);

		// ProvisionUserUseCase(프로비저닝 수렴)도 실제 인스턴스로 위임 — 소셜 신규가입
		// 테스트가 유저·OAuth계정·프로필 생성과 기본값 시딩을 그대로 검증하도록 배선.
		// 기본값 시딩은 OAuthService 직접 의존이 아니므로 시더 포트를 독립 mock으로 구성한다.
		const provisionUser = unitRef.get(ProvisionUserUseCase);
		const seederStub = mockOf<UserProvisioningSeederPort>({
			seedDefaultSettings: jest.fn(),
			seedDefaultCategories: jest.fn(),
		});
		const realProvisionUser = new ProvisionUserUseCase(
			asDep(userRepo),
			asDep(accountRepo),
			seederStub,
		);
		provisionUser.execute.mockImplementation((input) =>
			realProvisionUser.execute(input),
		);

		// ConfigService 기본 설정
		setupDefaultConfigService();

		// OAuth 신원 제공자 레지스트리: 실제 어댑터를 mock 검증기·configService에 배선
		// (프로덕션 auth.module의 useFactory와 동일 구성을 spec으로 재현 —
		//  OAuthService는 이제 검증기를 직접 주입받지 않고 registry.get으로 전략을 얻는다)
		tokenVerifier = mockOf<OAuthTokenVerifierService>({
			verifyToken: jest.fn(),
			verifyAppleToken: jest.fn(),
			verifyGoogleToken: jest.fn(),
			verifyKakaoToken: jest.fn(),
			verifyNaverToken: jest.fn(),
		});

		const logger = new Logger(OAuthService.name);
		const verifier = asDep<OAuthTokenVerifierService>(tokenVerifier);
		const realProviders = new Map<AccountProvider, OAuthIdentityProvider>([
			["APPLE", new AppleOAuthProvider(verifier)],
			[
				"GOOGLE",
				new GoogleOAuthProvider(
					() => configService.googleOAuth,
					verifier,
					logger,
				),
			],
			[
				"KAKAO",
				new KakaoOAuthProvider(
					() => configService.kakaoOAuth,
					verifier,
					logger,
				),
			],
			[
				"NAVER",
				new NaverOAuthProvider(
					() => configService.naverOAuth,
					verifier,
					logger,
				),
			],
		]);
		const registry = unitRef.get<OAuthIdentityProviderRegistry>(
			OAUTH_IDENTITY_PROVIDER_REGISTRY,
		);
		registry.get = jest.fn((p) => realProviders.get(p));
	});

	/**
	 * ConfigService 기본 설정 헬퍼
	 */
	const setupDefaultConfigService = () => {
		Object.defineProperty(configService, "kakaoOAuth", {
			get: () => ({
				clientId: "test-kakao-client-id",
				clientSecret: "test-kakao-client-secret",
				callbackUrl: "http://localhost:3000/v1/auth/kakao/web-callback",
				isConfigured: true,
			}),
			configurable: true,
		});

		Object.defineProperty(configService, "googleOAuth", {
			get: () => ({
				clientId: "test-google-client-id",
				clientSecret: "test-google-client-secret",
				callbackUrl: "http://localhost:3000/v1/auth/google/web-callback",
				isConfigured: true,
			}),
			configurable: true,
		});

		Object.defineProperty(configService, "naverOAuth", {
			get: () => ({
				clientId: "test-naver-client-id",
				clientSecret: "test-naver-client-secret",
				callbackUrl: "http://localhost:3000/v1/auth/naver/web-callback",
				isConfigured: true,
			}),
			configurable: true,
		});
	};

	/**
	 * OAuth 로그인 성공 시나리오 mock 설정 헬퍼
	 */
	const setupSuccessfulOAuthLogin = (
		mockUser: ReturnType<typeof UserBuilder.prototype.build>,
	) => {
		asMock(sessionService.createSessionWithTokens).mockResolvedValue({
			sessionId: "session-123",
			tokens: mockTokens,
			tokenFamily: "family-123",
		});
		asMock(securityLogRepo.create).mockResolvedValue({
			id: 1,
			userId: mockUser.id,
			event: "LOGIN_SUCCESS",
			ipAddress: mockMetadata.ip,
			userAgent: mockMetadata.userAgent,
			metadata: null,
			createdAt: new Date(),
		});
		asMock(loginAttemptRepo.create).mockResolvedValue({
			id: 1,
			email: mockUser.email,
			provider: null,
			success: true,
			failureReason: null,
			ipAddress: mockMetadata.ip,
			userAgent: mockMetadata.userAgent,
			createdAt: new Date(),
		});
		asMock(userRepo.findByIdWithProfile).mockResolvedValue({
			id: mockUser.id,
			email: mockUser.email,
			userTag: mockUser.userTag,
			role: mockUser.role,
			status: mockUser.status,
			emailVerifiedAt: mockUser.emailVerifiedAt,
			subscriptionStatus: mockUser.subscriptionStatus,
			subscriptionExpiresAt: mockUser.subscriptionExpiresAt,
			createdAt: mockUser.createdAt,
			lastLoginAt: mockUser.lastLoginAt,
			profile: { name: "테스트유저", profileImage: null },
		});
		uow.run.mockImplementation((work) => work());
		// #createSessionAndTokens / #restoreAndCreateSession에서 role 조회용
		userRepo.findById.mockResolvedValue(mockUser);
	};

	describe("handleAppleMobileLogin", () => {
		const appleVerifiedProfile: AppleVerifiedProfile = {
			id: "apple-user-123",
			email: "test@privaterelay.appleid.com",
			emailVerified: true,
		};

		describe("기존 사용자 로그인", () => {
			it("기존 Apple 사용자가 모바일 로그인하면 토큰을 발급한다", async () => {
				// Given - Builder로 테스트 데이터 생성
				const mockUser = UserBuilder.create()
					.withId("user-123")
					.withEmail("test@privaterelay.appleid.com")
					.verified()
					.build();

				const existingAccount = AccountBuilder.create(mockUser.id)
					.asApple("apple-user-123")
					.build();

				setupSuccessfulOAuthLogin(mockUser);
				tokenVerifier.verifyAppleToken.mockResolvedValue(appleVerifiedProfile);
				accountRepo.findByProviderAccountId.mockResolvedValue(existingAccount);
				userRepo.findById.mockResolvedValue(mockUser);

				// When
				const result = await service.handleAppleMobileLogin("valid-id-token");

				// Then
				expect(result).toEqual({
					userId: "user-123",
					userTag: mockUser.userTag,
					tokens: mockTokens,
					sessionId: "session-123",
					name: "테스트유저",
					profileImage: null,
				});
				expect(tokenVerifier.verifyAppleToken).toHaveBeenCalledWith(
					"valid-id-token",
					undefined,
				);
				expect(accountRepo.findByProviderAccountId).toHaveBeenCalledWith(
					"APPLE",
					"apple-user-123",
				);
				expect(userRepo.create).not.toHaveBeenCalled();
			});

			it("기존 사용자 로그인 시 user.registered 이벤트를 발행하지 않는다", async () => {
				// Given
				const mockUser = UserBuilder.create()
					.withId("user-123")
					.withEmail("test@privaterelay.appleid.com")
					.verified()
					.build();

				const existingAccount = AccountBuilder.create(mockUser.id)
					.asApple("apple-user-123")
					.build();

				setupSuccessfulOAuthLogin(mockUser);
				tokenVerifier.verifyAppleToken.mockResolvedValue(appleVerifiedProfile);
				accountRepo.findByProviderAccountId.mockResolvedValue(existingAccount);
				userRepo.findById.mockResolvedValue(mockUser);

				// When
				await service.handleAppleMobileLogin("valid-id-token");

				// Then
				expect(
					adminNotificationFacade.notifyUserRegistered,
				).not.toHaveBeenCalled();
			});
		});

		describe("신규 사용자 회원가입", () => {
			it("신규 Apple 사용자는 자동 회원가입 후 토큰을 발급한다", async () => {
				// Given
				const mockUser = UserBuilder.create()
					.withId("user-123")
					.withEmail("test@privaterelay.appleid.com")
					.verified()
					.build();

				setupSuccessfulOAuthLogin(mockUser);
				tokenVerifier.verifyAppleToken.mockResolvedValue(appleVerifiedProfile);
				accountRepo.findByProviderAccountId.mockResolvedValue(null);
				userRepo.findByEmail.mockResolvedValue(null);
				userRepo.create.mockResolvedValue(mockUser);
				asMock(accountRepo.createOAuthAccount).mockResolvedValue({});
				asMock(userRepo.createProfile).mockResolvedValue({});

				// When
				const result = await service.handleAppleMobileLogin(
					"valid-id-token",
					"홍길동",
				);

				// Then
				expect(result.userId).toBe("user-123");
				expect(result.tokens).toEqual(mockTokens);
				expect(userRepo.create).toHaveBeenCalledWith(
					expect.objectContaining({
						email: "test@privaterelay.appleid.com",
						status: "ACTIVE",
					}),
				);
				expect(accountRepo.createOAuthAccount).toHaveBeenCalledWith(
					expect.objectContaining({
						userId: "user-123",
						provider: "APPLE",
						providerAccountId: "apple-user-123",
					}),
				);
				expect(securityLogRepo.create).toHaveBeenCalledWith(
					expect.objectContaining({
						userId: "user-123",
						event: SECURITY_EVENT.REGISTRATION,
					}),
				);
			});

			it("신규 소셜 회원가입 시 관리자 알림 및 온보딩 큐 잡을 등록한다", async () => {
				// Given
				const mockUser = UserBuilder.create()
					.withId("user-123")
					.withEmail("test@privaterelay.appleid.com")
					.verified()
					.build();

				setupSuccessfulOAuthLogin(mockUser);
				tokenVerifier.verifyAppleToken.mockResolvedValue(appleVerifiedProfile);
				accountRepo.findByProviderAccountId.mockResolvedValue(null);
				userRepo.findByEmail.mockResolvedValue(null);
				userRepo.create.mockResolvedValue(mockUser);
				asMock(accountRepo.createOAuthAccount).mockResolvedValue({});
				asMock(userRepo.createProfile).mockResolvedValue({});

				// When
				await service.handleAppleMobileLogin("valid-id-token", "홍길동");

				// Then
				expect(
					adminNotificationFacade.notifyUserRegistered,
				).toHaveBeenCalledWith(
					expect.objectContaining({
						userId: "user-123",
						email: "test@privaterelay.appleid.com",
						provider: "apple",
					}),
				);
				// 기본 카테고리는 #createSocialUser() 트랜잭션 내에서 동기 생성됨 (큐 아님)
			});

			it("이메일 없이 신규 로그인 시 플레이스홀더 이메일로 가입된다", async () => {
				// Given
				const profileWithoutEmail: AppleVerifiedProfile = {
					id: "apple-user-456",
					email: null,
					emailVerified: false,
				};
				const mockUser = UserBuilder.create()
					.withId("new-user-id")
					.withEmail("apple_apple-user-456@social.aido.kr")
					.verified()
					.build();

				setupSuccessfulOAuthLogin(mockUser);
				tokenVerifier.verifyAppleToken.mockResolvedValue(profileWithoutEmail);
				accountRepo.findByProviderAccountId.mockResolvedValue(null);
				userRepo.create.mockResolvedValue(mockUser);
				asMock(accountRepo.createOAuthAccount).mockResolvedValue({});
				asMock(userRepo.createProfile).mockResolvedValue({});

				// When
				const result = await service.handleAppleMobileLogin("valid-id-token");

				// Then
				expect(result.tokens).toHaveProperty("accessToken");
				expect(userRepo.create).toHaveBeenCalledWith(
					expect.objectContaining({
						email: "apple_apple-user-456@social.aido.kr",
					}),
				);
			});
		});

		describe("자동 계정 연동", () => {
			it("이메일이 이미 존재하는 경우 자동 연동된다 (Apple은 신뢰된 Provider)", async () => {
				// Given
				const existingUser = UserBuilder.create()
					.withId("other-user")
					.withEmail("test@privaterelay.appleid.com")
					.verified()
					.build();

				setupSuccessfulOAuthLogin(existingUser);
				tokenVerifier.verifyAppleToken.mockResolvedValue(appleVerifiedProfile);
				accountRepo.findByProviderAccountId.mockResolvedValue(null);
				userRepo.findByEmail.mockResolvedValue(existingUser);
				asMock(accountRepo.createOAuthAccount).mockResolvedValue({});
				asMock(userRepo.findByIdWithProfile).mockResolvedValue({
					...existingUser,
					profile: { name: "기존유저", profileImage: null },
				});

				// When
				const result = await service.handleAppleMobileLogin("valid-id-token");

				// Then - Apple은 신뢰된 Provider이므로 자동 연동됨
				expect(result.userId).toBe("other-user");
				expect(accountRepo.createOAuthAccount).toHaveBeenCalledWith(
					expect.objectContaining({
						userId: "other-user",
						provider: "APPLE",
						providerAccountId: "apple-user-123",
					}),
				);
				expect(securityLogRepo.create).toHaveBeenCalledWith(
					expect.objectContaining({
						event: SECURITY_EVENT.OAUTH_AUTO_LINKED,
					}),
				);
			});
		});

		describe("계정 상태 검증", () => {
			it("계정이 잠긴 사용자는 로그인할 수 없다", async () => {
				// Given - Builder로 잠긴 사용자 생성
				const lockedUser = UserBuilder.create()
					.withId("user-123")
					.withEmail("test@privaterelay.appleid.com")
					.locked()
					.build();

				const existingAccount = AccountBuilder.create(lockedUser.id)
					.asApple("apple-user-123")
					.build();

				tokenVerifier.verifyAppleToken.mockResolvedValue(appleVerifiedProfile);
				accountRepo.findByProviderAccountId.mockResolvedValue(existingAccount);
				userRepo.findById.mockResolvedValue(lockedUser);
				asMock(loginAttemptRepo.create).mockResolvedValue({});

				// When & Then - 계정 상태 게이트는 도메인 불변식(account-status-policy)이 소유
				await expect(
					service.handleAppleMobileLogin("valid-id-token"),
				).rejects.toThrow(DomainException);
			});

			it("정지된 사용자는 로그인할 수 없다", async () => {
				// Given - Builder로 정지된 사용자 생성
				const suspendedUser = UserBuilder.create()
					.withId("user-123")
					.withEmail("test@privaterelay.appleid.com")
					.suspended()
					.build();

				const existingAccount = AccountBuilder.create(suspendedUser.id)
					.asApple("apple-user-123")
					.build();

				tokenVerifier.verifyAppleToken.mockResolvedValue(appleVerifiedProfile);
				accountRepo.findByProviderAccountId.mockResolvedValue(existingAccount);
				userRepo.findById.mockResolvedValue(suspendedUser);
				asMock(loginAttemptRepo.create).mockResolvedValue({});

				// When & Then - 계정 상태 게이트는 도메인 불변식(account-status-policy)이 소유
				await expect(
					service.handleAppleMobileLogin("valid-id-token"),
				).rejects.toThrow(DomainException);
			});

			it("탈퇴한 사용자는 소셜 로그인할 수 없다", async () => {
				// Given - 유예 기간(30일) 초과된 탈퇴 사용자 생성
				const pastGracePeriod = new Date();
				pastGracePeriod.setDate(pastGracePeriod.getDate() - 31);
				const deletedUser = UserBuilder.create()
					.withId("user-123")
					.withEmail("test@privaterelay.appleid.com")
					.verified()
					.deleted(pastGracePeriod)
					.build();

				const existingAccount = AccountBuilder.create(deletedUser.id)
					.asApple("apple-user-123")
					.build();

				tokenVerifier.verifyAppleToken.mockResolvedValue(appleVerifiedProfile);
				accountRepo.findByProviderAccountId.mockResolvedValue(existingAccount);
				userRepo.findById.mockResolvedValue(deletedUser);
				asMock(loginAttemptRepo.create).mockResolvedValue({});

				// When & Then - 탈퇴 계정 복구 불변식(account-restoration-policy)이 소유
				await expect(
					service.handleAppleMobileLogin("valid-id-token"),
				).rejects.toThrow(DomainException);
			});
		});
	});

	describe("linkAccount", () => {
		it("새로운 소셜 계정을 연결한다", async () => {
			// Given
			accountRepo.findByProviderAccountId.mockResolvedValue(null);
			asMock(accountRepo.createOAuthAccount).mockResolvedValue({});
			asMock(securityLogRepo.create).mockResolvedValue({});
			uow.run.mockImplementation((work) => work());

			// When
			const result = await service.linkAccount(
				"user-123",
				"APPLE",
				"apple-account-456",
			);

			// Then
			expect(result).toEqual({ message: "계정이 연결되었습니다." });
			expect(accountRepo.createOAuthAccount).toHaveBeenCalledWith({
				userId: "user-123",
				provider: "APPLE",
				providerAccountId: "apple-account-456",
				refreshToken: undefined,
			});
			expect(cacheService.invalidateUserProfile).toHaveBeenCalledWith(
				"user-123",
			);
		});

		it("이미 연결된 계정은 메시지를 반환한다", async () => {
			// Given - Builder로 계정 생성
			const existingAccount = AccountBuilder.create("user-123")
				.asApple("apple-account-456")
				.build();

			accountRepo.findByProviderAccountId.mockResolvedValue(existingAccount);

			// When
			const result = await service.linkAccount(
				"user-123",
				"APPLE",
				"apple-account-456",
			);

			// Then
			expect(result).toEqual({ message: "이미 연결된 계정입니다." });
			expect(accountRepo.createOAuthAccount).not.toHaveBeenCalled();
		});

		it("P2002 unique constraint 시 provider별 alreadyLinked를 던져야 한다", async () => {
			// Given - 계정 없음 + 트랜잭션 내에서 P2002 발생
			accountRepo.findByProviderAccountId.mockResolvedValue(null);
			accountRepo.createOAuthAccount.mockRejectedValue(
				new Prisma.PrismaClientKnownRequestError("Unique constraint", {
					code: "P2002",
					meta: { target: ["provider", "providerAccountId"] },
					clientVersion: "7.0.0",
				}),
			);
			uow.run.mockImplementation((work) => work());

			// When & Then - KAKAO provider
			await expect(
				service.linkAccount("user-123", "KAKAO", "kakao-account-789"),
			).rejects.toThrow(
				new ApplicationException(ErrorCode.KAKAO_0306, {
					kakaoId: "kakao-account-789",
				}),
			);
		});

		it("SecurityLog(OAUTH_LINKED)를 기록한다", async () => {
			// Given
			accountRepo.findByProviderAccountId.mockResolvedValue(null);
			asMock(accountRepo.createOAuthAccount).mockResolvedValue({});
			asMock(securityLogRepo.create).mockResolvedValue({});
			uow.run.mockImplementation((work) => work());

			// When
			await service.linkAccount(
				"user-123",
				"GOOGLE",
				"google-account-789",
				undefined,
				mockMetadata,
			);

			// Then
			expect(securityLogRepo.create).toHaveBeenCalledWith(
				expect.objectContaining({
					userId: "user-123",
					event: SECURITY_EVENT.OAUTH_LINKED,
					ipAddress: mockMetadata.ip,
					userAgent: mockMetadata.userAgent,
					metadata: {
						provider: "GOOGLE",
						providerAccountId: "google-account-789",
					},
				}),
			);
		});

		it("다른 사용자에 연결된 계정은 에러를 발생시킨다", async () => {
			// Given - Builder로 다른 사용자의 계정 생성
			const otherUserAccount = AccountBuilder.create("other-user-789")
				.asApple("apple-account-456")
				.build();

			accountRepo.findByProviderAccountId.mockResolvedValue(otherUserAccount);

			// When & Then
			await expect(
				service.linkAccount("user-123", "APPLE", "apple-account-456"),
			).rejects.toThrow(ApplicationException);
		});
	});

	describe("unlinkAccount", () => {
		it("연결된 소셜 계정을 해제한다", async () => {
			// Given - Builder로 계정 생성
			const appleAccount = AccountBuilder.create("user-123")
				.asApple("apple-account-456")
				.build();
			const credentialAccount = AccountBuilder.create("user-123")
				.asCredential()
				.build();

			accountRepo.findByUserIdAndProvider.mockResolvedValue(appleAccount);
			accountRepo.findAllByUserId.mockResolvedValue([
				appleAccount,
				credentialAccount,
			]);
			asMock(accountRepo.deleteAccount).mockResolvedValue({});
			asMock(securityLogRepo.create).mockResolvedValue({});
			uow.run.mockImplementation((work) => work());

			// When
			const result = await service.unlinkAccount("user-123", "APPLE");

			// Then
			expect(result).toEqual({ message: "계정 연결이 해제되었습니다." });
			expect(accountRepo.deleteAccount).toHaveBeenCalledWith(
				"user-123",
				"APPLE",
			);
			expect(cacheService.invalidateUserProfile).toHaveBeenCalledWith(
				"user-123",
			);
		});

		it("SecurityLog(OAUTH_UNLINKED)를 기록한다", async () => {
			// Given - Builder로 계정 생성
			const appleAccount = AccountBuilder.create("user-123")
				.asApple("apple-account-456")
				.build();
			const credentialAccount = AccountBuilder.create("user-123")
				.asCredential()
				.build();

			accountRepo.findByUserIdAndProvider.mockResolvedValue(appleAccount);
			accountRepo.findAllByUserId.mockResolvedValue([
				appleAccount,
				credentialAccount,
			]);
			asMock(accountRepo.deleteAccount).mockResolvedValue({});
			asMock(securityLogRepo.create).mockResolvedValue({});
			uow.run.mockImplementation((work) => work());

			// When
			await service.unlinkAccount("user-123", "APPLE", mockMetadata);

			// Then
			expect(securityLogRepo.create).toHaveBeenCalledWith(
				expect.objectContaining({
					userId: "user-123",
					event: SECURITY_EVENT.OAUTH_UNLINKED,
					ipAddress: mockMetadata.ip,
					userAgent: mockMetadata.userAgent,
					metadata: { provider: "APPLE" },
				}),
			);
		});

		it("연결되지 않은 계정은 에러를 발생시킨다", async () => {
			// Given
			accountRepo.findByUserIdAndProvider.mockResolvedValue(null);

			// When & Then
			await expect(service.unlinkAccount("user-123", "APPLE")).rejects.toThrow(
				ApplicationException,
			);
		});

		it("마지막 로그인 수단은 해제할 수 없다", async () => {
			// Given - Builder로 단일 계정 생성
			const appleAccount = AccountBuilder.create("user-123")
				.asApple("apple-account-456")
				.build();

			accountRepo.findByUserIdAndProvider.mockResolvedValue(appleAccount);
			accountRepo.findAllByUserId.mockResolvedValue([appleAccount]);

			// When & Then
			await expect(service.unlinkAccount("user-123", "APPLE")).rejects.toThrow(
				ApplicationException,
			);
		});
	});

	describe("getLinkedAccounts", () => {
		it("4개 provider 전체를 반환하며 연결된 계정은 linked: true", async () => {
			// Given - Builder로 계정들 생성
			const linkedAt = new Date("2024-01-15");
			const appleAccount = AccountBuilder.create("user-123")
				.asApple("apple-account-456")
				.withCreatedAt(linkedAt)
				.build();
			const credentialAccount = AccountBuilder.create("user-123")
				.asCredential()
				.withCreatedAt(linkedAt)
				.build();

			accountRepo.findAllByUserId.mockResolvedValue([
				appleAccount,
				credentialAccount,
			]);

			// When
			const result = await service.getLinkedAccounts("user-123");

			// Then - 항상 4개 provider 반환
			expect(result.accounts).toHaveLength(4);

			// APPLE은 linked
			expect(result.accounts).toContainEqual({
				provider: "APPLE",
				linked: true,
				providerAccountId: "apple-account-456",
				linkedAt,
			});

			// 나머지 3개는 unlinked
			for (const provider of ["GOOGLE", "KAKAO", "NAVER"]) {
				expect(result.accounts).toContainEqual({
					provider,
					linked: false,
					providerAccountId: null,
					linkedAt: null,
				});
			}

			// CREDENTIAL은 포함되지 않음
			expect(result.accounts).not.toContainEqual(
				expect.objectContaining({ provider: "CREDENTIAL" }),
			);

			// canUnlink: CREDENTIAL + APPLE = 2개이므로 true
			expect(result.canUnlink).toBe(true);
		});

		it("소셜 계정이 없으면 모든 제공자가 미연결 상태로 반환된다", async () => {
			// Given - Builder로 Credential 계정만 생성
			const linkedAt = new Date("2024-01-15");
			const credentialAccount = AccountBuilder.create("user-123")
				.asCredential()
				.withCreatedAt(linkedAt)
				.build();

			accountRepo.findAllByUserId.mockResolvedValue([credentialAccount]);

			// When
			const result = await service.getLinkedAccounts("user-123");

			// Then - 4개 전부 미연결
			expect(result.accounts).toHaveLength(4);
			expect(result.accounts.every((a) => a.linked === false)).toBe(true);
			expect(result.accounts.every((a) => a.providerAccountId === null)).toBe(
				true,
			);
			expect(result.accounts.every((a) => a.linkedAt === null)).toBe(true);

			// canUnlink: CREDENTIAL 1개만 있으므로 false
			expect(result.canUnlink).toBe(false);
		});

		it("CREDENTIAL + 1개 OAuth이면 canUnlink: true", async () => {
			// Given - CREDENTIAL + GOOGLE 계정
			const linkedAt = new Date("2024-01-15");
			const credentialAccount = AccountBuilder.create("user-123")
				.asCredential()
				.withCreatedAt(linkedAt)
				.build();
			const googleAccount = AccountBuilder.create("user-123")
				.asGoogle("google-account-789")
				.withCreatedAt(linkedAt)
				.build();

			accountRepo.findAllByUserId.mockResolvedValue([
				credentialAccount,
				googleAccount,
			]);

			// When
			const result = await service.getLinkedAccounts("user-123");

			// Then - 2개 계정이므로 canUnlink: true
			expect(result.canUnlink).toBe(true);
			expect(result.accounts).toContainEqual({
				provider: "GOOGLE",
				linked: true,
				providerAccountId: "google-account-789",
				linkedAt,
			});
		});
	});

	describe("linkSocialAccountWithToken", () => {
		beforeEach(() => {
			// linkAccount 내부에서 사용하는 $transaction mock
			uow.run.mockImplementation((work) => work());
			asMock(accountRepo.createOAuthAccount).mockResolvedValue({});
			asMock(securityLogRepo.create).mockResolvedValue({});
		});

		it("Apple idToken으로 소셜 계정을 연동한다", async () => {
			// Given
			asMock(tokenVerifier.verifyAppleToken).mockResolvedValue({
				id: "apple-id-123",
				email: "apple@example.com",
				emailVerified: true,
			});
			accountRepo.findByProviderAccountId.mockResolvedValue(null);

			// When
			const result = await service.linkSocialAccountWithToken(
				"user-123",
				{ provider: "APPLE", idToken: "valid-apple-id-token" },
				mockMetadata,
			);

			// Then
			expect(result).toEqual({ message: "계정이 연결되었습니다." });
			expect(tokenVerifier.verifyAppleToken).toHaveBeenCalledWith(
				"valid-apple-id-token",
				undefined,
			);
			expect(accountRepo.createOAuthAccount).toHaveBeenCalledWith(
				expect.objectContaining({
					userId: "user-123",
					provider: "APPLE",
					providerAccountId: "apple-id-123",
				}),
			);
		});

		it("Google idToken으로 소셜 계정을 연동한다", async () => {
			// Given
			asMock(tokenVerifier.verifyGoogleToken).mockResolvedValue({
				id: "google-id-123",
				email: "google@example.com",
				emailVerified: true,
				name: "Google User",
				picture: "https://example.com/photo.jpg",
			});
			accountRepo.findByProviderAccountId.mockResolvedValue(null);

			// When
			const result = await service.linkSocialAccountWithToken(
				"user-123",
				{ provider: "GOOGLE", idToken: "valid-google-id-token" },
				mockMetadata,
			);

			// Then
			expect(result).toEqual({ message: "계정이 연결되었습니다." });
			expect(tokenVerifier.verifyGoogleToken).toHaveBeenCalledWith(
				"valid-google-id-token",
			);
			expect(accountRepo.createOAuthAccount).toHaveBeenCalledWith(
				expect.objectContaining({
					userId: "user-123",
					provider: "GOOGLE",
					providerAccountId: "google-id-123",
				}),
			);
		});

		it("Kakao accessToken으로 소셜 계정을 연동한다", async () => {
			// Given
			asMock(tokenVerifier.verifyKakaoToken).mockResolvedValue({
				id: "kakao-id-123",
				email: "kakao@example.com",
				emailVerified: true,
				name: "Kakao User",
				picture: "https://kakao.com/photo.jpg",
			});
			accountRepo.findByProviderAccountId.mockResolvedValue(null);

			// When
			const result = await service.linkSocialAccountWithToken(
				"user-123",
				{ provider: "KAKAO", accessToken: "valid-kakao-access-token" },
				mockMetadata,
			);

			// Then
			expect(result).toEqual({ message: "계정이 연결되었습니다." });
			expect(tokenVerifier.verifyKakaoToken).toHaveBeenCalledWith(
				"valid-kakao-access-token",
			);
			expect(accountRepo.createOAuthAccount).toHaveBeenCalledWith(
				expect.objectContaining({
					userId: "user-123",
					provider: "KAKAO",
					providerAccountId: "kakao-id-123",
				}),
			);
		});

		it("Naver accessToken으로 소셜 계정을 연동한다", async () => {
			// Given
			asMock(tokenVerifier.verifyNaverToken).mockResolvedValue({
				id: "naver-id-123",
				email: "naver@example.com",
				emailVerified: true,
				name: "Naver User",
				picture: "https://naver.com/photo.jpg",
			});
			accountRepo.findByProviderAccountId.mockResolvedValue(null);

			// When
			const result = await service.linkSocialAccountWithToken(
				"user-123",
				{ provider: "NAVER", accessToken: "valid-naver-access-token" },
				mockMetadata,
			);

			// Then
			expect(result).toEqual({ message: "계정이 연결되었습니다." });
			expect(tokenVerifier.verifyNaverToken).toHaveBeenCalledWith(
				"valid-naver-access-token",
			);
			expect(accountRepo.createOAuthAccount).toHaveBeenCalledWith(
				expect.objectContaining({
					userId: "user-123",
					provider: "NAVER",
					providerAccountId: "naver-id-123",
				}),
			);
		});

		it("토큰 검증 실패 시 에러를 전파한다", async () => {
			// Given
			tokenVerifier.verifyAppleToken.mockRejectedValue(
				new Error("Invalid token"),
			);

			// When & Then
			await expect(
				service.linkSocialAccountWithToken(
					"user-123",
					{ provider: "APPLE", idToken: "invalid-token" },
					mockMetadata,
				),
			).rejects.toThrow("Invalid token");
		});

		it("이미 다른 유저에 연결된 계정은 provider별 409 에러를 반환한다", async () => {
			// Given
			asMock(tokenVerifier.verifyKakaoToken).mockResolvedValue({
				id: "kakao-id-existing",
				email: "kakao@example.com",
				emailVerified: true,
				name: "Kakao User",
				picture: "https://kakao.com/photo.jpg",
			});

			const otherUserAccount = AccountBuilder.create("other-user-999")
				.asKakao("kakao-id-existing")
				.build();
			accountRepo.findByProviderAccountId.mockResolvedValue(otherUserAccount);

			// When & Then
			await expect(
				service.linkSocialAccountWithToken(
					"user-123",
					{ provider: "KAKAO", accessToken: "valid-kakao-access-token" },
					mockMetadata,
				),
			).rejects.toThrow(ApplicationException);
		});
	});

	describe("Redirect URI 검증", () => {
		const testState = "test-state-123";

		describe("프로덕션 환경", () => {
			beforeEach(() => {
				Object.defineProperty(configService, "isDevelopment", {
					get: () => false,
					configurable: true,
				});
			});

			it("aido://auth/kakao를 허용한다", async () => {
				// Given
				const redirectUri = "aido://auth/kakao";
				asMock(oauthStateRepo.create).mockResolvedValue({});

				// When
				await service.generateKakaoAuthUrlWithState(testState, redirectUri);

				// Then
				expect(oauthStateRepo.create).toHaveBeenCalledWith(
					testState,
					"KAKAO",
					redirectUri,
					{ mode: undefined, initiatingUserId: undefined },
				);
			});

			it("https://api.aido.kr/callback을 허용한다", async () => {
				// Given
				const redirectUri = "https://api.aido.kr/callback";
				asMock(oauthStateRepo.create).mockResolvedValue({});

				// When
				await service.generateKakaoAuthUrlWithState(testState, redirectUri);

				// Then
				expect(oauthStateRepo.create).toHaveBeenCalledWith(
					testState,
					"KAKAO",
					redirectUri,
					{ mode: undefined, initiatingUserId: undefined },
				);
			});

			it("exp:// 스킴을 거부하고 기본값으로 대체한다", async () => {
				// Given
				const redirectUri = "exp://192.168.1.1:8081";
				asMock(oauthStateRepo.create).mockResolvedValue({});

				// When
				await service.generateKakaoAuthUrlWithState(testState, redirectUri);

				// Then
				expect(oauthStateRepo.create).toHaveBeenCalledWith(
					testState,
					"KAKAO",
					"aido://auth/callback",
					{ mode: undefined, initiatingUserId: undefined },
				);
			});

			it("http://localhost를 거부하고 기본값으로 대체한다", async () => {
				// Given
				const redirectUri = "http://localhost:8081";
				asMock(oauthStateRepo.create).mockResolvedValue({});

				// When
				await service.generateKakaoAuthUrlWithState(testState, redirectUri);

				// Then
				expect(oauthStateRepo.create).toHaveBeenCalledWith(
					testState,
					"KAKAO",
					"aido://auth/callback",
					{ mode: undefined, initiatingUserId: undefined },
				);
			});

			it("aido-dev:// 스킴을 거부하고 기본값으로 대체한다", async () => {
				// Given
				const redirectUri = "aido-dev://auth/kakao";
				asMock(oauthStateRepo.create).mockResolvedValue({});

				// When
				await service.generateKakaoAuthUrlWithState(testState, redirectUri);

				// Then
				expect(oauthStateRepo.create).toHaveBeenCalledWith(
					testState,
					"KAKAO",
					"aido://auth/callback",
					{ mode: undefined, initiatingUserId: undefined },
				);
			});

			it("임의의 서브도메인(evil.aido.kr)을 거부한다", async () => {
				// Given
				const redirectUri = "https://evil.aido.kr/steal";
				asMock(oauthStateRepo.create).mockResolvedValue({});

				// When
				await service.generateKakaoAuthUrlWithState(testState, redirectUri);

				// Then
				expect(oauthStateRepo.create).toHaveBeenCalledWith(
					testState,
					"KAKAO",
					"aido://auth/callback",
					{ mode: undefined, initiatingUserId: undefined },
				);
			});
		});

		describe("개발 환경", () => {
			beforeEach(() => {
				Object.defineProperty(configService, "isDevelopment", {
					get: () => true,
					configurable: true,
				});
			});

			it("aido-dev://auth/kakao를 허용한다", async () => {
				// Given
				const redirectUri = "aido-dev://auth/kakao";
				asMock(oauthStateRepo.create).mockResolvedValue({});

				// When
				await service.generateKakaoAuthUrlWithState(testState, redirectUri);

				// Then
				expect(oauthStateRepo.create).toHaveBeenCalledWith(
					testState,
					"KAKAO",
					redirectUri,
					{ mode: undefined, initiatingUserId: undefined },
				);
			});

			it("http://localhost:8081을 허용한다", async () => {
				// Given
				const redirectUri = "http://localhost:8081";
				asMock(oauthStateRepo.create).mockResolvedValue({});

				// When
				await service.generateKakaoAuthUrlWithState(testState, redirectUri);

				// Then
				expect(oauthStateRepo.create).toHaveBeenCalledWith(
					testState,
					"KAKAO",
					redirectUri,
					{ mode: undefined, initiatingUserId: undefined },
				);
			});

			it("exp://192.168.1.1:8081을 허용한다", async () => {
				// Given
				const redirectUri = "exp://192.168.1.1:8081";
				asMock(oauthStateRepo.create).mockResolvedValue({});

				// When
				await service.generateKakaoAuthUrlWithState(testState, redirectUri);

				// Then
				expect(oauthStateRepo.create).toHaveBeenCalledWith(
					testState,
					"KAKAO",
					redirectUri,
					{ mode: undefined, initiatingUserId: undefined },
				);
			});
		});

		describe("공통", () => {
			it("URI가 제공되지 않으면 기본값을 사용한다", async () => {
				// Given
				asMock(oauthStateRepo.create).mockResolvedValue({});

				// When
				await service.generateKakaoAuthUrlWithState(testState);

				// Then
				expect(oauthStateRepo.create).toHaveBeenCalledWith(
					testState,
					"KAKAO",
					"aido://auth/callback",
					{ mode: undefined, initiatingUserId: undefined },
				);
			});
		});
	});

	describe("getRedirectUriByState", () => {
		it("state가 존재하면 저장된 redirect_uri를 반환한다", async () => {
			// Given
			asMock(oauthStateRepo.findByState).mockResolvedValue({
				redirectUri: "aido-dev://auth/naver",
			});

			// When
			const redirectUri = await service.getRedirectUriByState("valid-state");

			// Then
			expect(redirectUri).toBe("aido-dev://auth/naver");
		});

		it("state가 없으면 null을 반환한다", async () => {
			// Given
			oauthStateRepo.findByState.mockResolvedValue(null);

			// When
			const redirectUri = await service.getRedirectUriByState("missing-state");

			// Then
			expect(redirectUri).toBeNull();
		});
	});

	describe("handleKakaoWebCallbackWithExchangeCode", () => {
		const mockKakaoProfile: OAuthProfile = {
			id: "kakao-user-123",
			email: "test@kakao.com",
			emailVerified: true,
			name: "카카오사용자",
			picture: "https://kakao.com/profile.jpg",
		};

		describe("state가 DB에 없는 경우 (CSRF 보호)", () => {
			it("state가 DB에 없으면 invalidCredentials를 throw해야 한다", async () => {
				// Given
				oauthStateRepo.findByState.mockResolvedValue(null);

				// When & Then
				await expect(
					service.handleKakaoWebCallbackWithExchangeCode(
						"test-code",
						"invalid-state",
					),
				).rejects.toThrow(ApplicationException);
			});

			it("state 검증 실패 시 토큰 교환을 수행하지 않아야 한다", async () => {
				// Given
				oauthStateRepo.findByState.mockResolvedValue(null);
				global.fetch = jest.fn();

				// When & Then
				await expect(
					service.handleKakaoWebCallbackWithExchangeCode(
						"test-code",
						"invalid-state",
					),
				).rejects.toThrow(ApplicationException);

				// fetch (토큰 교환)가 호출되지 않아야 한다
				expect(global.fetch).not.toHaveBeenCalled();
			});
		});

		describe("유효한 state로 정상 플로우", () => {
			it("유효한 state로 정상 플로우가 동작해야 한다", async () => {
				// Given
				const mockOAuthState = {
					id: 3,
					state: "valid-state",
					provider: "KAKAO" as const,
					redirectUri: "aido://auth/callback",
					mode: null,
					codeVerifier: null,
					exchangeCode: null,
					accessToken: null,
					refreshToken: null,
					userId: null,
					userName: null,
					profileImage: null,
					accountRestored: null,
					ipAddress: null,
					userAgent: null,
					initiatingUserId: null,
					exchangedAt: null,
					expiresAt: new Date(Date.now() + 600000),
					createdAt: new Date(),
				};
				oauthStateRepo.findByState.mockResolvedValue(mockOAuthState);

				const mockUser = UserBuilder.create()
					.withId("user-123")
					.withEmail("test@kakao.com")
					.verified()
					.build();
				const existingAccount = AccountBuilder.create(mockUser.id)
					.asKakao("kakao-user-123")
					.build();

				setupSuccessfulOAuthLogin(mockUser);
				asMock(userRepo.findByIdWithProfile).mockResolvedValue({
					...mockUser,
					profile: {
						name: "카카오사용자",
						profileImage: "https://kakao.com/profile.jpg",
					},
				});

				tokenVerifier.verifyKakaoToken.mockResolvedValue(mockKakaoProfile);
				accountRepo.findByProviderAccountId.mockResolvedValue(existingAccount);
				userRepo.findById.mockResolvedValue(mockUser);

				global.fetch = jest.fn().mockResolvedValue({
					ok: true,
					json: () =>
						Promise.resolve({
							access_token: "kakao-access-token",
							token_type: "bearer",
							refresh_token: "kakao-refresh-token",
							expires_in: 21599,
						}),
				});

				oauthStateRepo.generateExchangeCode.mockReturnValue(
					"test-exchange-code",
				);
				asMock(oauthStateRepo.saveExchangeData).mockResolvedValue({});

				// When
				const result = await service.handleKakaoWebCallbackWithExchangeCode(
					"test-code",
					"valid-state",
				);

				// Then
				expect(result.exchangeCode).toBe("test-exchange-code");
				expect(result.redirectUri).toBe("aido://auth/callback");
				expect(result.userId).toBe("user-123");

				expect(global.fetch).toHaveBeenCalledWith(
					"https://kauth.kakao.com/oauth/token",
					expect.objectContaining({
						method: "POST",
						body: expect.stringContaining("code=test-code"),
					}),
				);
			});
		});
	});

	describe("LoginAttempt 기록", () => {
		describe("Apple 로그인", () => {
			it("Apple 토큰 검증 실패 시 LoginAttempt 실패 기록", async () => {
				// Given
				tokenVerifier.verifyAppleToken.mockRejectedValue(
					new Error("Invalid token"),
				);
				asMock(loginAttemptRepo.create).mockResolvedValue({});

				// When & Then
				await expect(
					service.handleAppleMobileLogin(
						"invalid-token",
						undefined,
						mockMetadata,
					),
				).rejects.toThrow();

				expect(loginAttemptRepo.create).toHaveBeenCalledWith({
					email: "apple_unknown@social.aido.kr",
					provider: "APPLE",
					ipAddress: mockMetadata.ip,
					userAgent: mockMetadata.userAgent,
					success: false,
					failureReason: LOGIN_FAILURE_REASON.OAUTH_TOKEN_INVALID,
				});
			});

			it("Apple 로그인 성공 시 LoginAttempt 성공 기록", async () => {
				// Given
				const mockUser = UserBuilder.create()
					.withId("user-123")
					.withEmail("test@privaterelay.appleid.com")
					.verified()
					.build();

				const appleProfile: AppleVerifiedProfile = {
					id: "apple-user-123",
					email: "test@privaterelay.appleid.com",
					emailVerified: true,
				};

				const existingAccount = AccountBuilder.create(mockUser.id)
					.asApple("apple-user-123")
					.build();

				setupSuccessfulOAuthLogin(mockUser);
				tokenVerifier.verifyAppleToken.mockResolvedValue(appleProfile);
				accountRepo.findByProviderAccountId.mockResolvedValue(existingAccount);
				userRepo.findById.mockResolvedValue(mockUser);

				// When
				await service.handleAppleMobileLogin(
					"valid-token",
					undefined,
					mockMetadata,
				);

				// Then
				expect(loginAttemptRepo.create).toHaveBeenCalledWith(
					expect.objectContaining({
						email: mockUser.email,
						provider: "APPLE",
						ipAddress: mockMetadata.ip,
						userAgent: mockMetadata.userAgent,
						success: true,
					}),
				);
			});
		});

		describe("Google 로그인", () => {
			it("Google 토큰 검증 실패 시 LoginAttempt 실패 기록", async () => {
				// Given
				tokenVerifier.verifyGoogleToken.mockRejectedValue(
					new Error("Invalid token"),
				);
				asMock(loginAttemptRepo.create).mockResolvedValue({});

				// When & Then
				await expect(
					service.handleGoogleMobileLogin(
						"invalid-token",
						undefined,
						mockMetadata,
					),
				).rejects.toThrow();

				expect(loginAttemptRepo.create).toHaveBeenCalledWith({
					email: "google_unknown@social.aido.kr",
					provider: "GOOGLE",
					ipAddress: mockMetadata.ip,
					userAgent: mockMetadata.userAgent,
					success: false,
					failureReason: LOGIN_FAILURE_REASON.OAUTH_TOKEN_INVALID,
				});
			});

			it("Google 로그인 성공 시 LoginAttempt 성공 기록", async () => {
				// Given
				const mockUser = UserBuilder.create()
					.withId("user-123")
					.withEmail("test@gmail.com")
					.verified()
					.build();

				const googleProfile: OAuthProfile = {
					id: "google-user-123",
					email: "test@gmail.com",
					emailVerified: true,
					name: "Test User",
					picture: "https://example.com/photo.jpg",
				};

				const existingAccount = AccountBuilder.create(mockUser.id)
					.asGoogle("google-user-123")
					.build();

				setupSuccessfulOAuthLogin(mockUser);
				tokenVerifier.verifyGoogleToken.mockResolvedValue(googleProfile);
				accountRepo.findByProviderAccountId.mockResolvedValue(existingAccount);
				userRepo.findById.mockResolvedValue(mockUser);

				// When
				await service.handleGoogleMobileLogin(
					"valid-token",
					undefined,
					mockMetadata,
				);

				// Then
				expect(loginAttemptRepo.create).toHaveBeenCalledWith(
					expect.objectContaining({
						email: "test@gmail.com",
						provider: "GOOGLE",
						ipAddress: mockMetadata.ip,
						userAgent: mockMetadata.userAgent,
						success: true,
					}),
				);
			});
		});

		describe("Kakao 로그인", () => {
			it("Kakao 토큰 검증 실패 시 LoginAttempt 실패 기록", async () => {
				// Given
				tokenVerifier.verifyKakaoToken.mockRejectedValue(
					new Error("Invalid token"),
				);
				asMock(loginAttemptRepo.create).mockResolvedValue({});

				// When & Then
				await expect(
					service.handleKakaoMobileLogin(
						"invalid-token",
						undefined,
						mockMetadata,
					),
				).rejects.toThrow();

				expect(loginAttemptRepo.create).toHaveBeenCalledWith({
					email: "kakao_unknown@social.aido.kr",
					provider: "KAKAO",
					ipAddress: mockMetadata.ip,
					userAgent: mockMetadata.userAgent,
					success: false,
					failureReason: LOGIN_FAILURE_REASON.OAUTH_TOKEN_INVALID,
				});
			});

			it("Kakao 로그인 성공 시 LoginAttempt 성공 기록", async () => {
				// Given
				const mockUser = UserBuilder.create()
					.withId("user-123")
					.withEmail("test@kakao.com")
					.verified()
					.build();

				const kakaoProfile: OAuthProfile = {
					id: "kakao-user-123",
					email: "test@kakao.com",
					emailVerified: true,
					name: "테스트",
					picture: "https://kakao.com/photo.jpg",
				};

				const existingAccount = AccountBuilder.create(mockUser.id)
					.asKakao("kakao-user-123")
					.build();

				setupSuccessfulOAuthLogin(mockUser);
				tokenVerifier.verifyKakaoToken.mockResolvedValue(kakaoProfile);
				accountRepo.findByProviderAccountId.mockResolvedValue(existingAccount);
				userRepo.findById.mockResolvedValue(mockUser);

				// When
				await service.handleKakaoMobileLogin(
					"valid-token",
					undefined,
					mockMetadata,
				);

				// Then
				expect(loginAttemptRepo.create).toHaveBeenCalledWith(
					expect.objectContaining({
						email: "test@kakao.com",
						provider: "KAKAO",
						ipAddress: mockMetadata.ip,
						userAgent: mockMetadata.userAgent,
						success: true,
					}),
				);
			});
		});

		describe("Naver 로그인", () => {
			it("Naver 토큰 검증 실패 시 LoginAttempt 실패 기록", async () => {
				// Given
				tokenVerifier.verifyNaverToken.mockRejectedValue(
					new Error("Invalid token"),
				);
				asMock(loginAttemptRepo.create).mockResolvedValue({});

				// When & Then
				await expect(
					service.handleNaverMobileLogin(
						"invalid-token",
						undefined,
						mockMetadata,
					),
				).rejects.toThrow();

				expect(loginAttemptRepo.create).toHaveBeenCalledWith({
					email: "naver_unknown@social.aido.kr",
					provider: "NAVER",
					ipAddress: mockMetadata.ip,
					userAgent: mockMetadata.userAgent,
					success: false,
					failureReason: LOGIN_FAILURE_REASON.OAUTH_TOKEN_INVALID,
				});
			});

			it("Naver 로그인 성공 시 LoginAttempt 성공 기록", async () => {
				// Given
				const mockUser = UserBuilder.create()
					.withId("user-123")
					.withEmail("test@naver.com")
					.verified()
					.build();

				const naverProfile: OAuthProfile = {
					id: "naver-user-123",
					email: "test@naver.com",
					emailVerified: true,
					name: "테스트",
					picture: "https://naver.com/photo.jpg",
				};

				const existingAccount = AccountBuilder.create(mockUser.id)
					.asNaver("naver-user-123")
					.build();

				setupSuccessfulOAuthLogin(mockUser);
				tokenVerifier.verifyNaverToken.mockResolvedValue(naverProfile);
				accountRepo.findByProviderAccountId.mockResolvedValue(existingAccount);
				userRepo.findById.mockResolvedValue(mockUser);

				// When
				await service.handleNaverMobileLogin(
					"valid-token",
					undefined,
					mockMetadata,
				);

				// Then
				expect(loginAttemptRepo.create).toHaveBeenCalledWith(
					expect.objectContaining({
						email: "test@naver.com",
						provider: "NAVER",
						ipAddress: mockMetadata.ip,
						userAgent: mockMetadata.userAgent,
						success: true,
					}),
				);
			});
		});

		describe("메타데이터 기본값", () => {
			it("메타데이터가 없으면 기본값을 사용한다", async () => {
				// Given
				tokenVerifier.verifyAppleToken.mockRejectedValue(
					new Error("Invalid token"),
				);
				asMock(loginAttemptRepo.create).mockResolvedValue({});

				// When & Then
				await expect(
					service.handleAppleMobileLogin("invalid-token"),
				).rejects.toThrow();

				expect(loginAttemptRepo.create).toHaveBeenCalledWith({
					email: "apple_unknown@social.aido.kr",
					provider: "APPLE",
					ipAddress: "unknown",
					userAgent: "unknown",
					success: false,
					failureReason: LOGIN_FAILURE_REASON.OAUTH_TOKEN_INVALID,
				});
			});
		});
	});

	describe("이메일 충돌 시 자동/강제 연동", () => {
		describe("Google (신뢰된 Provider)", () => {
			const googleProfile: OAuthProfile = {
				id: "google-user-456",
				email: "test@example.com",
				emailVerified: true,
				name: "Test User",
				picture: "https://example.com/photo.jpg",
			};

			it("이메일 검증된 Google 계정은 기존 사용자에 자동 연동된다", async () => {
				// Given - Builder로 기존 사용자 생성
				const existingUser = UserBuilder.create()
					.withId("existing-user-123")
					.withEmail("test@example.com")
					.verified()
					.build();

				setupSuccessfulOAuthLogin(existingUser);
				tokenVerifier.verifyGoogleToken.mockResolvedValue(googleProfile);
				accountRepo.findByProviderAccountId.mockResolvedValue(null);
				userRepo.findByEmail.mockResolvedValue(existingUser);
				asMock(accountRepo.createOAuthAccount).mockResolvedValue({});

				// When
				const result = await service.handleGoogleMobileLogin(
					"valid-google-token",
					undefined,
					mockMetadata,
				);

				// Then
				expect(result.userId).toBe("existing-user-123");
				expect(result.tokens).toEqual(mockTokens);

				// 자동 연동 확인
				expect(accountRepo.createOAuthAccount).toHaveBeenCalledWith(
					expect.objectContaining({
						userId: "existing-user-123",
						provider: "GOOGLE",
						providerAccountId: "google-user-456",
					}),
				);

				// SecurityLog에 OAUTH_AUTO_LINKED 기록 확인
				expect(securityLogRepo.create).toHaveBeenCalledWith(
					expect.objectContaining({
						userId: "existing-user-123",
						event: SECURITY_EVENT.OAUTH_AUTO_LINKED,
						metadata: expect.objectContaining({
							provider: "GOOGLE",
							autoLinked: true,
						}),
					}),
				);

				// 신규 사용자 생성은 하지 않음
				expect(userRepo.create).not.toHaveBeenCalled();
			});

			it("이메일 미검증된 Google 계정은 강제 연동 에러를 반환한다", async () => {
				// Given
				const unverifiedProfile = { ...googleProfile, emailVerified: false };
				const existingUser = UserBuilder.create()
					.withId("existing-user-123")
					.withEmail("test@example.com")
					.verified()
					.build();

				tokenVerifier.verifyGoogleToken.mockResolvedValue(unverifiedProfile);
				accountRepo.findByProviderAccountId.mockResolvedValue(null);
				userRepo.findByEmail.mockResolvedValue(existingUser);
				asMock(securityLogRepo.create).mockResolvedValue({});
				asMock(loginAttemptRepo.create).mockResolvedValue({});

				// When & Then
				await expect(
					service.handleGoogleMobileLogin(
						"valid-google-token",
						undefined,
						mockMetadata,
					),
				).rejects.toThrow(ApplicationException);

				// SecurityLog에 OAUTH_LINK_REQUIRED 기록 확인
				expect(securityLogRepo.create).toHaveBeenCalledWith(
					expect.objectContaining({
						userId: "existing-user-123",
						event: SECURITY_EVENT.OAUTH_LINK_REQUIRED,
						metadata: expect.objectContaining({
							provider: "GOOGLE",
							reason: "email_not_verified",
						}),
					}),
				);

				// 계정 생성 안함
				expect(accountRepo.createOAuthAccount).not.toHaveBeenCalled();
			});
		});

		describe("Apple (신뢰된 Provider)", () => {
			const appleProfile: AppleVerifiedProfile = {
				id: "apple-user-456",
				email: "test@example.com",
				emailVerified: true,
			};

			it("이메일 검증된 Apple 계정은 기존 사용자에 자동 연동된다", async () => {
				// Given - Builder로 기존 사용자 생성
				const existingUser = UserBuilder.create()
					.withId("existing-user-123")
					.withEmail("test@example.com")
					.verified()
					.build();

				setupSuccessfulOAuthLogin(existingUser);
				tokenVerifier.verifyAppleToken.mockResolvedValue(appleProfile);
				accountRepo.findByProviderAccountId.mockResolvedValue(null);
				userRepo.findByEmail.mockResolvedValue(existingUser);
				asMock(accountRepo.createOAuthAccount).mockResolvedValue({});

				// When
				const result = await service.handleAppleMobileLogin(
					"valid-apple-token",
					undefined,
					mockMetadata,
				);

				// Then
				expect(result.userId).toBe("existing-user-123");

				// 자동 연동 확인
				expect(accountRepo.createOAuthAccount).toHaveBeenCalledWith(
					expect.objectContaining({
						userId: "existing-user-123",
						provider: "APPLE",
						providerAccountId: "apple-user-456",
					}),
				);

				// SecurityLog에 OAUTH_AUTO_LINKED 기록 확인
				expect(securityLogRepo.create).toHaveBeenCalledWith(
					expect.objectContaining({
						userId: "existing-user-123",
						event: SECURITY_EVENT.OAUTH_AUTO_LINKED,
						metadata: expect.objectContaining({
							provider: "APPLE",
							autoLinked: true,
						}),
					}),
				);
			});
		});

		describe("Kakao (신뢰되지 않은 Provider)", () => {
			const kakaoProfile: OAuthProfile = {
				id: "kakao-user-456",
				email: "test@example.com",
				emailVerified: true,
				name: "카카오유저",
				picture: "https://kakao.com/photo.jpg",
			};

			it("Kakao 계정은 이메일 충돌 시 항상 강제 연동 에러를 반환한다", async () => {
				// Given - Builder로 기존 사용자 생성
				const existingUser = UserBuilder.create()
					.withId("existing-user-123")
					.withEmail("test@example.com")
					.verified()
					.build();

				tokenVerifier.verifyKakaoToken.mockResolvedValue(kakaoProfile);
				accountRepo.findByProviderAccountId.mockResolvedValue(null);
				userRepo.findByEmail.mockResolvedValue(existingUser);
				asMock(securityLogRepo.create).mockResolvedValue({});
				asMock(loginAttemptRepo.create).mockResolvedValue({});

				// When & Then
				await expect(
					service.handleKakaoMobileLogin(
						"valid-kakao-token",
						undefined,
						mockMetadata,
					),
				).rejects.toThrow(ApplicationException);

				// SecurityLog에 OAUTH_LINK_REQUIRED 기록 확인
				expect(securityLogRepo.create).toHaveBeenCalledWith(
					expect.objectContaining({
						userId: "existing-user-123",
						event: SECURITY_EVENT.OAUTH_LINK_REQUIRED,
						metadata: expect.objectContaining({
							provider: "KAKAO",
							reason: "untrusted_provider",
						}),
					}),
				);

				// 계정 자동 생성 안함
				expect(accountRepo.createOAuthAccount).not.toHaveBeenCalled();
			});

			it("Kakao 이메일 미검증 시에도 강제 연동 에러를 반환한다", async () => {
				// Given
				const unverifiedProfile = { ...kakaoProfile, emailVerified: false };
				const existingUser = UserBuilder.create()
					.withId("existing-user-123")
					.withEmail("test@example.com")
					.verified()
					.build();

				tokenVerifier.verifyKakaoToken.mockResolvedValue(unverifiedProfile);
				accountRepo.findByProviderAccountId.mockResolvedValue(null);
				userRepo.findByEmail.mockResolvedValue(existingUser);
				asMock(securityLogRepo.create).mockResolvedValue({});
				asMock(loginAttemptRepo.create).mockResolvedValue({});

				// When & Then
				await expect(
					service.handleKakaoMobileLogin(
						"valid-kakao-token",
						undefined,
						mockMetadata,
					),
				).rejects.toThrow(ApplicationException);

				// untrusted_provider 이유로 기록
				expect(securityLogRepo.create).toHaveBeenCalledWith(
					expect.objectContaining({
						event: SECURITY_EVENT.OAUTH_LINK_REQUIRED,
						metadata: expect.objectContaining({
							reason: "untrusted_provider",
						}),
					}),
				);
			});
		});

		describe("Naver (신뢰되지 않은 Provider)", () => {
			const naverProfile: OAuthProfile = {
				id: "naver-user-456",
				email: "test@example.com",
				emailVerified: true,
				name: "네이버유저",
				picture: "https://naver.com/photo.jpg",
			};

			it("Naver 계정은 이메일 충돌 시 항상 강제 연동 에러를 반환한다", async () => {
				// Given - Builder로 기존 사용자 생성
				const existingUser = UserBuilder.create()
					.withId("existing-user-123")
					.withEmail("test@example.com")
					.verified()
					.build();

				tokenVerifier.verifyNaverToken.mockResolvedValue(naverProfile);
				accountRepo.findByProviderAccountId.mockResolvedValue(null);
				userRepo.findByEmail.mockResolvedValue(existingUser);
				asMock(securityLogRepo.create).mockResolvedValue({});
				asMock(loginAttemptRepo.create).mockResolvedValue({});

				// When & Then
				await expect(
					service.handleNaverMobileLogin(
						"valid-naver-token",
						undefined,
						mockMetadata,
					),
				).rejects.toThrow(ApplicationException);

				// SecurityLog에 OAUTH_LINK_REQUIRED 기록 확인
				expect(securityLogRepo.create).toHaveBeenCalledWith(
					expect.objectContaining({
						userId: "existing-user-123",
						event: SECURITY_EVENT.OAUTH_LINK_REQUIRED,
						metadata: expect.objectContaining({
							provider: "NAVER",
							reason: "untrusted_provider",
						}),
					}),
				);

				// 계정 자동 생성 안함
				expect(accountRepo.createOAuthAccount).not.toHaveBeenCalled();
			});
		});

		describe("잠긴/정지된 사용자", () => {
			const googleProfile: OAuthProfile = {
				id: "google-user-789",
				email: "locked@example.com",
				emailVerified: true,
				name: "Locked User",
			};

			it("잠긴 사용자에게는 자동 연동되지 않는다", async () => {
				// Given - Builder로 잠긴 사용자 생성
				const lockedUser = UserBuilder.create()
					.withId("existing-user-123")
					.withEmail("locked@example.com")
					.locked()
					.build();

				tokenVerifier.verifyGoogleToken.mockResolvedValue(googleProfile);
				accountRepo.findByProviderAccountId.mockResolvedValue(null);
				userRepo.findByEmail.mockResolvedValue(lockedUser);
				asMock(loginAttemptRepo.create).mockResolvedValue({});

				// When & Then - 계정 상태 게이트는 도메인 불변식(account-status-policy)이 소유
				await expect(
					service.handleGoogleMobileLogin(
						"valid-google-token",
						undefined,
						mockMetadata,
					),
				).rejects.toThrow(DomainException);
			});

			it("정지된 사용자에게는 자동 연동되지 않는다", async () => {
				// Given - Builder로 정지된 사용자 생성
				const suspendedUser = UserBuilder.create()
					.withId("existing-user-123")
					.withEmail("suspended@example.com")
					.suspended()
					.build();

				const suspendedProfile = {
					...googleProfile,
					email: "suspended@example.com",
				};

				tokenVerifier.verifyGoogleToken.mockResolvedValue(suspendedProfile);
				accountRepo.findByProviderAccountId.mockResolvedValue(null);
				userRepo.findByEmail.mockResolvedValue(suspendedUser);
				asMock(loginAttemptRepo.create).mockResolvedValue({});

				// When & Then - 계정 상태 게이트는 도메인 불변식(account-status-policy)이 소유
				await expect(
					service.handleGoogleMobileLogin(
						"valid-google-token",
						undefined,
						mockMetadata,
					),
				).rejects.toThrow(DomainException);
			});

			it("탈퇴한 사용자에게는 자동 연동되지 않는다", async () => {
				// Given
				const deletedUser = UserBuilder.create()
					.withId("existing-user-123")
					.withEmail("deleted@example.com")
					.verified()
					.deleted()
					.build();

				const deletedProfile = {
					...googleProfile,
					email: "deleted@example.com",
				};

				tokenVerifier.verifyGoogleToken.mockResolvedValue(deletedProfile);
				accountRepo.findByProviderAccountId.mockResolvedValue(null);
				userRepo.findByEmail.mockResolvedValue(deletedUser);
				asMock(loginAttemptRepo.create).mockResolvedValue({});

				// When & Then
				await expect(
					service.handleGoogleMobileLogin(
						"valid-google-token",
						undefined,
						mockMetadata,
					),
				).rejects.toThrow(ApplicationException);
			});
		});
	});

	describe("자동 연동 트랜잭션 원자성", () => {
		const atomicGoogleProfile: OAuthProfile = {
			id: "google-atomic-456",
			email: "atomic@example.com",
			emailVerified: true,
			name: "Atomic User",
			picture: "https://example.com/atomic.jpg",
		};

		it("비복구 자동 연동 중 OAuth 계정 연동이 실패하면 세션을 발급하지 않고 에러를 전파한다", async () => {
			// Given - 이메일 충돌 자동 연동 대상(활성·검증된 기존 사용자)
			const existingUser = UserBuilder.create()
				.withId("existing-atomic-1")
				.withEmail("atomic@example.com")
				.verified()
				.build();

			setupSuccessfulOAuthLogin(existingUser);
			tokenVerifier.verifyGoogleToken.mockResolvedValue(atomicGoogleProfile);
			accountRepo.findByProviderAccountId.mockResolvedValue(null);
			userRepo.findByEmail.mockResolvedValue(existingUser);
			uow.run.mockImplementation((work) => work());
			// 연동(OAuth 계정 생성)이 트랜잭션 내에서 실패
			accountRepo.createOAuthAccount.mockRejectedValue(
				new Error("createOAuthAccount failed"),
			);

			// When & Then - 에러가 전파된다
			await expect(
				service.handleGoogleMobileLogin(
					"valid-google-token",
					undefined,
					mockMetadata,
				),
			).rejects.toThrow("createOAuthAccount failed");

			// 연동이 세션 생성과 하나의 트랜잭션으로 묶여 먼저 수행되므로,
			// 연동 실패 시 세션은 발급되지 않는다(부분 커밋 없음).
			expect(sessionService.createSessionWithTokens).not.toHaveBeenCalled();
		});

		it("복구 자동 연동 중 연동이 실패하면 커밋 후 프로필 캐시 무효화에 도달하지 않는다", async () => {
			// Given - 유예 기간 내 탈퇴 사용자(복구 대상) + 이메일 충돌
			const deletedUser = UserBuilder.create()
				.withId("existing-atomic-2")
				.withEmail("atomic-restore@example.com")
				.verified()
				.deleted() // deletedAt = now (유예 기간 이내 → 복구 대상)
				.build();

			setupSuccessfulOAuthLogin(deletedUser);
			tokenVerifier.verifyGoogleToken.mockResolvedValue({
				...atomicGoogleProfile,
				email: "atomic-restore@example.com",
			});
			accountRepo.findByProviderAccountId.mockResolvedValue(null);
			userRepo.findByEmail.mockResolvedValue(deletedUser);
			// #restoreAndCreateSession이 role 조회용으로 findById 사용
			userRepo.findById.mockResolvedValue(deletedUser);
			asMock(userRepo.restore).mockResolvedValue(deletedUser);
			uow.run.mockImplementation((work) => work());
			// 트랜잭션 내부 연동 단계가 실패
			accountRepo.createOAuthAccount.mockRejectedValue(
				new Error("link failed in tx"),
			);

			// When & Then
			await expect(
				service.handleGoogleMobileLogin(
					"valid-google-token",
					undefined,
					mockMetadata,
				),
			).rejects.toThrow("link failed in tx");

			// 연동은 복구·세션과 같은 트랜잭션(커밋 전)에서 수행되므로,
			// 실패 시 커밋 후 단계인 프로필 캐시 무효화에 도달하지 않는다(전체 롤백).
			expect(cacheService.invalidateUserProfile).not.toHaveBeenCalled();
		});
	});

	describe("handleKakaoWebCallbackWithExchangeCode", () => {
		describe("state가 DB에 없는 경우 (CSRF 보호)", () => {
			it("state가 DB에 없으면 invalidCredentials를 throw해야 한다", async () => {
				// Given
				oauthStateRepo.findByState.mockResolvedValue(null);

				// When & Then
				await expect(
					service.handleKakaoWebCallbackWithExchangeCode(
						"test-code",
						"invalid-state",
					),
				).rejects.toThrow(ApplicationException);
			});

			it("state 검증 실패 시 토큰 교환을 수행하지 않아야 한다", async () => {
				// Given
				oauthStateRepo.findByState.mockResolvedValue(null);
				global.fetch = jest.fn();

				// When & Then
				await expect(
					service.handleKakaoWebCallbackWithExchangeCode(
						"test-code",
						"invalid-state",
					),
				).rejects.toThrow(ApplicationException);

				// fetch (토큰 교환)가 호출되지 않아야 한다
				expect(global.fetch).not.toHaveBeenCalled();
			});
		});

		describe("유효한 state로 정상 플로우", () => {
			it("유효한 state로 정상 플로우가 동작해야 한다", async () => {
				// Given
				const mockOAuthState = {
					id: 1,
					state: "valid-state",
					provider: "KAKAO" as const,
					redirectUri: "aido://auth/callback",
					mode: null,
					codeVerifier: null,
					exchangeCode: null,
					accessToken: null,
					refreshToken: null,
					userId: null,
					userName: null,
					profileImage: null,
					accountRestored: null,
					ipAddress: null,
					userAgent: null,
					initiatingUserId: null,
					exchangedAt: null,
					expiresAt: new Date(Date.now() + 600000),
					createdAt: new Date(),
				};
				oauthStateRepo.findByState.mockResolvedValue(mockOAuthState);

				const mockUser = UserBuilder.create()
					.withId("user-123")
					.withEmail("test@kakao.com")
					.verified()
					.build();
				const existingAccount = AccountBuilder.create(mockUser.id)
					.asKakao("kakao-user-123")
					.build();

				setupSuccessfulOAuthLogin(mockUser);
				asMock(userRepo.findByIdWithProfile).mockResolvedValue({
					...mockUser,
					profile: {
						name: "카카오사용자",
						profileImage: "https://kakao.com/profile.jpg",
					},
				});

				const mockKakaoProfile: OAuthProfile = {
					id: "kakao-user-123",
					email: "test@kakao.com",
					emailVerified: true,
					name: "카카오사용자",
					picture: "https://kakao.com/profile.jpg",
				};
				tokenVerifier.verifyKakaoToken.mockResolvedValue(mockKakaoProfile);
				accountRepo.findByProviderAccountId.mockResolvedValue(existingAccount);
				userRepo.findById.mockResolvedValue(mockUser);

				global.fetch = jest.fn().mockResolvedValue({
					ok: true,
					json: () =>
						Promise.resolve({
							access_token: "kakao-access-token",
							token_type: "bearer",
							refresh_token: "kakao-refresh-token",
							expires_in: 21599,
						}),
				});

				oauthStateRepo.generateExchangeCode.mockReturnValue(
					"test-exchange-code",
				);
				asMock(oauthStateRepo.saveExchangeData).mockResolvedValue({});

				// When
				const result = await service.handleKakaoWebCallbackWithExchangeCode(
					"test-code",
					"valid-state",
				);

				// Then
				expect(result.exchangeCode).toBe("test-exchange-code");
				expect(result.redirectUri).toBe("aido://auth/callback");
				expect(result.userId).toBe("user-123");
			});
		});
	});

	describe("handleGoogleWebCallbackWithExchangeCode", () => {
		describe("state가 DB에 없는 경우 (CSRF 보호)", () => {
			it("state가 DB에 없으면 invalidCredentials를 throw해야 한다", async () => {
				// Given
				oauthStateRepo.findByState.mockResolvedValue(null);

				// When & Then
				await expect(
					service.handleGoogleWebCallbackWithExchangeCode(
						"test-code",
						"invalid-state",
					),
				).rejects.toThrow(ApplicationException);
			});

			it("state 검증 실패 시 토큰 교환을 수행하지 않아야 한다", async () => {
				// Given
				oauthStateRepo.findByState.mockResolvedValue(null);
				global.fetch = jest.fn();

				// When & Then
				await expect(
					service.handleGoogleWebCallbackWithExchangeCode(
						"test-code",
						"invalid-state",
					),
				).rejects.toThrow(ApplicationException);

				// fetch (토큰 교환)가 호출되지 않아야 한다
				expect(global.fetch).not.toHaveBeenCalled();
			});
		});

		describe("유효한 state로 정상 플로우", () => {
			it("유효한 state로 정상 플로우가 동작해야 한다", async () => {
				// Given
				const mockOAuthState = {
					id: 2,
					state: "valid-state",
					provider: "GOOGLE" as const,
					redirectUri: "aido://auth/callback",
					mode: null,
					codeVerifier: null,
					exchangeCode: null,
					accessToken: null,
					refreshToken: null,
					userId: null,
					userName: null,
					profileImage: null,
					accountRestored: null,
					ipAddress: null,
					userAgent: null,
					initiatingUserId: null,
					exchangedAt: null,
					expiresAt: new Date(Date.now() + 600000),
					createdAt: new Date(),
				};
				oauthStateRepo.findByState.mockResolvedValue(mockOAuthState);

				const mockUser = UserBuilder.create()
					.withId("user-123")
					.withEmail("test@gmail.com")
					.verified()
					.build();
				const existingAccount = AccountBuilder.create(mockUser.id)
					.asGoogle("google-user-123")
					.build();

				setupSuccessfulOAuthLogin(mockUser);
				asMock(userRepo.findByIdWithProfile).mockResolvedValue({
					...mockUser,
					profile: {
						name: "구글사용자",
						profileImage: "https://google.com/profile.jpg",
					},
				});

				const mockGoogleProfile: OAuthProfile = {
					id: "google-user-123",
					email: "test@gmail.com",
					emailVerified: true,
					name: "구글사용자",
					picture: "https://google.com/profile.jpg",
				};
				tokenVerifier.verifyGoogleToken.mockResolvedValue(mockGoogleProfile);
				accountRepo.findByProviderAccountId.mockResolvedValue(existingAccount);
				userRepo.findById.mockResolvedValue(mockUser);

				global.fetch = jest.fn().mockResolvedValue({
					ok: true,
					json: () =>
						Promise.resolve({
							access_token: "google-access-token",
							id_token: "google-id-token",
							token_type: "bearer",
							expires_in: 3600,
						}),
				});

				oauthStateRepo.generateExchangeCode.mockReturnValue(
					"test-exchange-code",
				);
				asMock(oauthStateRepo.saveExchangeData).mockResolvedValue({});

				// When
				const result = await service.handleGoogleWebCallbackWithExchangeCode(
					"test-code",
					"valid-state",
				);

				// Then
				expect(result.exchangeCode).toBe("test-exchange-code");
				expect(result.redirectUri).toBe("aido://auth/callback");
				expect(result.userId).toBe("user-123");

				expect(global.fetch).toHaveBeenCalledWith(
					"https://oauth2.googleapis.com/token",
					expect.objectContaining({
						method: "POST",
						body: expect.stringContaining("code=test-code"),
					}),
				);
			});
		});
	});

	describe("handleNaverWebCallbackWithExchangeCode", () => {
		describe("state가 DB에 없는 경우 (CSRF 보호)", () => {
			it("state가 DB에 없으면 invalidCredentials를 throw해야 한다", async () => {
				// Given
				oauthStateRepo.findByState.mockResolvedValue(null);

				// When & Then
				await expect(
					service.handleNaverWebCallbackWithExchangeCode(
						"test-code",
						"invalid-state",
					),
				).rejects.toThrow(ApplicationException);
			});

			it("state 검증 실패 시 토큰 교환을 수행하지 않아야 한다", async () => {
				// Given
				oauthStateRepo.findByState.mockResolvedValue(null);
				global.fetch = jest.fn();

				// When & Then
				await expect(
					service.handleNaverWebCallbackWithExchangeCode(
						"test-code",
						"invalid-state",
					),
				).rejects.toThrow(ApplicationException);

				// fetch (토큰 교환)가 호출되지 않아야 한다
				expect(global.fetch).not.toHaveBeenCalled();
			});
		});

		describe("유효한 state로 정상 플로우", () => {
			it("유효한 state로 정상 플로우가 동작해야 한다", async () => {
				// Given
				const mockOAuthState = {
					id: 3,
					state: "valid-state",
					provider: "NAVER" as const,
					redirectUri: "aido://auth/callback",
					mode: null,
					codeVerifier: null,
					exchangeCode: null,
					accessToken: null,
					refreshToken: null,
					userId: null,
					userName: null,
					profileImage: null,
					accountRestored: null,
					ipAddress: null,
					userAgent: null,
					initiatingUserId: null,
					exchangedAt: null,
					expiresAt: new Date(Date.now() + 600000),
					createdAt: new Date(),
				};
				oauthStateRepo.findByState.mockResolvedValue(mockOAuthState);

				const mockUser = UserBuilder.create()
					.withId("user-123")
					.withEmail("test@naver.com")
					.verified()
					.build();
				const existingAccount = AccountBuilder.create(mockUser.id)
					.asNaver("naver-user-123")
					.build();

				setupSuccessfulOAuthLogin(mockUser);
				asMock(userRepo.findByIdWithProfile).mockResolvedValue({
					...mockUser,
					profile: {
						name: "네이버사용자",
						profileImage: "https://naver.com/profile.jpg",
					},
				});

				const mockNaverProfile: OAuthProfile = {
					id: "naver-user-123",
					email: "test@naver.com",
					emailVerified: true,
					name: "네이버사용자",
					picture: "https://naver.com/profile.jpg",
				};
				tokenVerifier.verifyNaverToken.mockResolvedValue(mockNaverProfile);
				accountRepo.findByProviderAccountId.mockResolvedValue(existingAccount);
				userRepo.findById.mockResolvedValue(mockUser);

				global.fetch = jest.fn().mockResolvedValue({
					ok: true,
					json: () =>
						Promise.resolve({
							access_token: "naver-access-token",
							token_type: "bearer",
							expires_in: 3600,
						}),
				});

				oauthStateRepo.generateExchangeCode.mockReturnValue(
					"test-exchange-code",
				);
				asMock(oauthStateRepo.saveExchangeData).mockResolvedValue({});

				// When
				const result = await service.handleNaverWebCallbackWithExchangeCode(
					"test-code",
					"valid-state",
				);

				// Then
				expect(result.exchangeCode).toBe("test-exchange-code");
				expect(result.redirectUri).toBe("aido://auth/callback");
				expect(result.userId).toBe("user-123");
			});
		});
	});

	describe("소셜 계정 연동 (Linking Mode)", () => {
		/** 공통 OAuthState mock 생성 헬퍼 */
		const createMockOAuthState = (
			overrides: Partial<{
				id: number;
				state: string;
				provider: "KAKAO" | "GOOGLE" | "NAVER";
				redirectUri: string;
				mode: string | null;
			}> = {},
		) => ({
			id: 1,
			state: "test-state",
			provider: "KAKAO" as const,
			redirectUri: "aido://auth/callback",
			mode: null,
			codeVerifier: null,
			exchangeCode: null,
			accessToken: null,
			refreshToken: null,
			userId: null,
			userName: null,
			profileImage: null,
			accountRestored: null,
			ipAddress: null,
			userAgent: null,
			initiatingUserId: null,
			exchangedAt: null,
			expiresAt: new Date(Date.now() + 600000),
			createdAt: new Date(),
			...overrides,
		});

		describe("Kakao linking", () => {
			it("mode=link일 때 Kakao 소셜 계정의 providerAccountId를 추출하고 exchangeCode를 발급한다", async () => {
				// Given
				const mockOAuthState = createMockOAuthState({
					provider: "KAKAO",
					mode: "link",
				});
				oauthStateRepo.findByState.mockResolvedValue(mockOAuthState);

				// Kakao token exchange mock
				global.fetch = jest.fn().mockResolvedValue({
					ok: true,
					json: () =>
						Promise.resolve({
							access_token: "test-kakao-access-token",
							token_type: "bearer",
							refresh_token: "test-kakao-refresh-token",
							expires_in: 21599,
						}),
				});

				// Kakao 토큰 검증 mock
				asMock(tokenVerifier.verifyKakaoToken).mockResolvedValue({
					id: "kakao-123",
					email: "kakao@example.com",
					emailVerified: true,
					name: "카카오유저",
					picture: "https://kakao.com/photo.jpg",
				});

				oauthStateRepo.generateExchangeCode.mockReturnValue(
					"link-exchange-code",
				);
				asMock(oauthStateRepo.saveLinkingData).mockResolvedValue({});

				// When
				const result = await service.handleKakaoWebCallbackWithExchangeCode(
					"test-auth-code",
					"test-state",
				);

				// Then - exchangeCode와 redirectUri가 반환됨
				expect(result.exchangeCode).toBe("link-exchange-code");
				expect(result.redirectUri).toBe("aido://auth/callback");
				expect(result.userId).toBe("kakao-123");

				// saveLinkingData가 올바르게 호출됨
				expect(oauthStateRepo.saveLinkingData).toHaveBeenCalledWith(
					mockOAuthState.id,
					{
						exchangeCode: "link-exchange-code",
						provider: "KAKAO",
						providerAccountId: "kakao-123",
					},
				);

				// 로그인 처리(handleKakaoMobileLogin)가 호출되지 않음 확인
				// login 모드에서는 saveExchangeData가 호출되지만, link 모드에서는 saveLinkingData가 호출됨
				expect(oauthStateRepo.saveExchangeData).not.toHaveBeenCalled();
			});

			it("mode=null(기본값)일 때 기존 로그인 플로우가 유지된다", async () => {
				// Given
				const mockOAuthState = createMockOAuthState({
					provider: "KAKAO",
					mode: null,
				});
				oauthStateRepo.findByState.mockResolvedValue(mockOAuthState);

				const mockUser = UserBuilder.create()
					.withId("user-123")
					.withEmail("test@kakao.com")
					.verified()
					.build();
				const existingAccount = AccountBuilder.create(mockUser.id)
					.asKakao("kakao-user-123")
					.build();

				setupSuccessfulOAuthLogin(mockUser);
				asMock(userRepo.findByIdWithProfile).mockResolvedValue({
					...mockUser,
					profile: {
						name: "카카오사용자",
						profileImage: "https://kakao.com/profile.jpg",
					},
				});

				asMock(tokenVerifier.verifyKakaoToken).mockResolvedValue({
					id: "kakao-user-123",
					email: "test@kakao.com",
					emailVerified: true,
					name: "카카오사용자",
					picture: "https://kakao.com/profile.jpg",
				});
				accountRepo.findByProviderAccountId.mockResolvedValue(existingAccount);
				userRepo.findById.mockResolvedValue(mockUser);

				global.fetch = jest.fn().mockResolvedValue({
					ok: true,
					json: () =>
						Promise.resolve({
							access_token: "kakao-access-token",
							token_type: "bearer",
							refresh_token: "kakao-refresh-token",
							expires_in: 21599,
						}),
				});

				oauthStateRepo.generateExchangeCode.mockReturnValue(
					"login-exchange-code",
				);
				asMock(oauthStateRepo.saveExchangeData).mockResolvedValue({});

				// When
				const result = await service.handleKakaoWebCallbackWithExchangeCode(
					"test-auth-code",
					"test-state",
				);

				// Then - 기존 로그인 플로우 결과
				expect(result.exchangeCode).toBe("login-exchange-code");
				expect(result.userId).toBe("user-123");

				// saveExchangeData가 호출됨 (login 모드)
				expect(oauthStateRepo.saveExchangeData).toHaveBeenCalled();
				// saveLinkingData는 호출되지 않음
				expect(oauthStateRepo.saveLinkingData).not.toHaveBeenCalled();
			});
		});

		describe("Google linking", () => {
			it("mode=link일 때 Google 소셜 계정의 providerAccountId를 추출하고 exchangeCode를 발급한다", async () => {
				// Given
				const mockOAuthState = createMockOAuthState({
					id: 2,
					provider: "GOOGLE",
					mode: "link",
				});
				oauthStateRepo.findByState.mockResolvedValue(mockOAuthState);

				// Google token exchange mock (idToken 반환)
				global.fetch = jest.fn().mockResolvedValue({
					ok: true,
					json: () =>
						Promise.resolve({
							access_token: "google-access-token",
							id_token: "google-id-token",
							token_type: "bearer",
							expires_in: 3600,
						}),
				});

				// Google 토큰 검증 mock
				asMock(tokenVerifier.verifyGoogleToken).mockResolvedValue({
					id: "google-123",
					email: "google@example.com",
					emailVerified: true,
					name: "Google User",
					picture: "https://google.com/photo.jpg",
				});

				oauthStateRepo.generateExchangeCode.mockReturnValue(
					"google-link-exchange-code",
				);
				asMock(oauthStateRepo.saveLinkingData).mockResolvedValue({});

				// When
				const result = await service.handleGoogleWebCallbackWithExchangeCode(
					"test-auth-code",
					"test-state",
				);

				// Then
				expect(result.exchangeCode).toBe("google-link-exchange-code");
				expect(result.redirectUri).toBe("aido://auth/callback");
				expect(result.userId).toBe("google-123");

				// saveLinkingData가 올바르게 호출됨
				expect(oauthStateRepo.saveLinkingData).toHaveBeenCalledWith(
					mockOAuthState.id,
					{
						exchangeCode: "google-link-exchange-code",
						provider: "GOOGLE",
						providerAccountId: "google-123",
					},
				);

				// 로그인 처리가 호출되지 않음
				expect(oauthStateRepo.saveExchangeData).not.toHaveBeenCalled();
			});
		});

		describe("Naver linking", () => {
			it("mode=link일 때 Naver 소셜 계정의 providerAccountId를 추출하고 exchangeCode를 발급한다", async () => {
				// Given
				const mockOAuthState = createMockOAuthState({
					id: 3,
					provider: "NAVER",
					mode: "link",
				});
				oauthStateRepo.findByState.mockResolvedValue(mockOAuthState);

				// Naver token exchange mock (accessToken 반환)
				global.fetch = jest.fn().mockResolvedValue({
					ok: true,
					json: () =>
						Promise.resolve({
							access_token: "naver-access-token",
							token_type: "bearer",
							expires_in: 3600,
						}),
				});

				// Naver 토큰 검증 mock
				asMock(tokenVerifier.verifyNaverToken).mockResolvedValue({
					id: "naver-123",
					email: "naver@example.com",
					emailVerified: true,
					name: "Naver User",
					picture: "https://naver.com/photo.jpg",
				});

				oauthStateRepo.generateExchangeCode.mockReturnValue(
					"naver-link-exchange-code",
				);
				asMock(oauthStateRepo.saveLinkingData).mockResolvedValue({});

				// When
				const result = await service.handleNaverWebCallbackWithExchangeCode(
					"test-auth-code",
					"test-state",
				);

				// Then
				expect(result.exchangeCode).toBe("naver-link-exchange-code");
				expect(result.redirectUri).toBe("aido://auth/callback");
				expect(result.userId).toBe("naver-123");

				// saveLinkingData가 올바르게 호출됨
				expect(oauthStateRepo.saveLinkingData).toHaveBeenCalledWith(
					mockOAuthState.id,
					{
						exchangeCode: "naver-link-exchange-code",
						provider: "NAVER",
						providerAccountId: "naver-123",
					},
				);

				// 로그인 처리가 호출되지 않음
				expect(oauthStateRepo.saveExchangeData).not.toHaveBeenCalled();
			});
		});
	});

	describe("linkAccountWithExchangeCode", () => {
		it("유효한 교환 코드로 소셜 계정을 연동한다", async () => {
			// Given
			const mockOAuthState = {
				id: 10,
				state: "test-state",
				provider: "GOOGLE" as const,
				redirectUri: "aido://auth/callback",
				mode: "link",
				codeVerifier: null,
				exchangeCode: "valid-exchange-code",
				accessToken: null,
				refreshToken: null,
				userId: "google-123", // providerAccountId가 userId 필드에 저장됨
				userName: null,
				profileImage: null,
				accountRestored: null,
				ipAddress: null,
				userAgent: null,
				initiatingUserId: null,
				exchangedAt: null,
				expiresAt: new Date(Date.now() + 600000),
				createdAt: new Date(),
			};
			oauthStateRepo.findByExchangeCode.mockResolvedValue(mockOAuthState);
			asMock(oauthStateRepo.markAsExchanged).mockResolvedValue({});

			// linkAccount 내부에서 사용하는 mock
			accountRepo.findByProviderAccountId.mockResolvedValue(null);
			asMock(accountRepo.createOAuthAccount).mockResolvedValue({});
			asMock(securityLogRepo.create).mockResolvedValue({});
			uow.run.mockImplementation((work) => work());

			// When
			const result = await service.linkAccountWithExchangeCode(
				"user-123",
				"valid-exchange-code",
				mockMetadata,
			);

			// Then
			expect(result).toEqual({ message: "계정이 연결되었습니다." });
			expect(oauthStateRepo.findByExchangeCode).toHaveBeenCalledWith(
				"valid-exchange-code",
			);
			expect(oauthStateRepo.markAsExchanged).toHaveBeenCalledWith(
				mockOAuthState.id,
			);
			expect(accountRepo.createOAuthAccount).toHaveBeenCalledWith(
				expect.objectContaining({
					userId: "user-123",
					provider: "GOOGLE",
					providerAccountId: "google-123",
				}),
			);
		});

		it("존재하지 않는 교환 코드이면 에러를 던진다", async () => {
			// Given
			oauthStateRepo.findByExchangeCode.mockResolvedValue(null);

			// When & Then
			await expect(
				service.linkAccountWithExchangeCode(
					"user-123",
					"non-existent-code",
					mockMetadata,
				),
			).rejects.toThrow(ApplicationException);
		});

		it("mode가 link가 아닌 교환 코드이면 에러를 던진다", async () => {
			// Given - login 모드 (mode: null)
			const loginModeState = {
				id: 11,
				state: "test-state",
				provider: "GOOGLE" as const,
				redirectUri: "aido://auth/callback",
				mode: null, // login 모드
				codeVerifier: null,
				exchangeCode: "login-exchange-code",
				accessToken: "encrypted-access-token",
				refreshToken: "encrypted-refresh-token",
				userId: "user-123",
				userName: null,
				profileImage: null,
				accountRestored: null,
				ipAddress: null,
				userAgent: null,
				initiatingUserId: null,
				exchangedAt: null,
				expiresAt: new Date(Date.now() + 600000),
				createdAt: new Date(),
			};
			oauthStateRepo.findByExchangeCode.mockResolvedValue(loginModeState);

			// When & Then
			await expect(
				service.linkAccountWithExchangeCode(
					"user-123",
					"login-exchange-code",
					mockMetadata,
				),
			).rejects.toThrow(ApplicationException);
		});

		it("providerAccountId(userId 필드)가 없으면 에러를 던진다", async () => {
			// Given
			const stateWithoutProviderAccountId = {
				id: 12,
				state: "test-state",
				provider: "KAKAO" as const,
				redirectUri: "aido://auth/callback",
				mode: "link",
				codeVerifier: null,
				exchangeCode: "link-exchange-code",
				accessToken: null,
				refreshToken: null,
				userId: null, // providerAccountId 없음
				userName: null,
				profileImage: null,
				accountRestored: null,
				ipAddress: null,
				userAgent: null,
				initiatingUserId: null,
				exchangedAt: null,
				expiresAt: new Date(Date.now() + 600000),
				createdAt: new Date(),
			};
			oauthStateRepo.findByExchangeCode.mockResolvedValue(
				stateWithoutProviderAccountId,
			);

			// When & Then
			await expect(
				service.linkAccountWithExchangeCode(
					"user-123",
					"link-exchange-code",
					mockMetadata,
				),
			).rejects.toThrow(ApplicationException);
		});

		it("initiatingUserId와 요청 userId가 일치하면 정상 연동된다", async () => {
			// Given
			const mockOAuthState = {
				id: 13,
				state: "test-state",
				provider: "GOOGLE" as const,
				redirectUri: "aido://auth/callback",
				mode: "link",
				codeVerifier: null,
				exchangeCode: "valid-exchange-code",
				accessToken: null,
				refreshToken: null,
				userId: "google-123",
				userName: null,
				profileImage: null,
				accountRestored: null,
				ipAddress: null,
				userAgent: null,
				initiatingUserId: "user-123", // 일치
				exchangedAt: null,
				expiresAt: new Date(Date.now() + 600000),
				createdAt: new Date(),
			};
			oauthStateRepo.findByExchangeCode.mockResolvedValue(mockOAuthState);
			asMock(oauthStateRepo.markAsExchanged).mockResolvedValue({});
			accountRepo.findByProviderAccountId.mockResolvedValue(null);
			asMock(accountRepo.createOAuthAccount).mockResolvedValue({});
			asMock(securityLogRepo.create).mockResolvedValue({});
			uow.run.mockImplementation((work) => work());

			// When
			const result = await service.linkAccountWithExchangeCode(
				"user-123",
				"valid-exchange-code",
				mockMetadata,
			);

			// Then
			expect(result).toEqual({ message: "계정이 연결되었습니다." });
		});

		it("initiatingUserId와 요청 userId가 불일치하면 에러를 던진다", async () => {
			// Given
			const mockOAuthState = {
				id: 14,
				state: "test-state",
				provider: "GOOGLE" as const,
				redirectUri: "aido://auth/callback",
				mode: "link",
				codeVerifier: null,
				exchangeCode: "stolen-exchange-code",
				accessToken: null,
				refreshToken: null,
				userId: "google-123",
				userName: null,
				profileImage: null,
				accountRestored: null,
				ipAddress: null,
				userAgent: null,
				initiatingUserId: "user-123", // 원래 사용자
				exchangedAt: null,
				expiresAt: new Date(Date.now() + 600000),
				createdAt: new Date(),
			};
			oauthStateRepo.findByExchangeCode.mockResolvedValue(mockOAuthState);

			// When & Then
			await expect(
				service.linkAccountWithExchangeCode(
					"attacker-456", // 공격자
					"stolen-exchange-code",
					mockMetadata,
				),
			).rejects.toThrow(ApplicationException);
		});

		it("initiatingUserId가 null이면 제한 없이 연동된다", async () => {
			// Given - 하위 호환: initiatingUserId 없는 기존 상태
			const mockOAuthState = {
				id: 15,
				state: "test-state",
				provider: "KAKAO" as const,
				redirectUri: "aido://auth/callback",
				mode: "link",
				codeVerifier: null,
				exchangeCode: "legacy-exchange-code",
				accessToken: null,
				refreshToken: null,
				userId: "kakao-456",
				userName: null,
				profileImage: null,
				accountRestored: null,
				ipAddress: null,
				userAgent: null,
				initiatingUserId: null, // 하위 호환
				exchangedAt: null,
				expiresAt: new Date(Date.now() + 600000),
				createdAt: new Date(),
			};
			oauthStateRepo.findByExchangeCode.mockResolvedValue(mockOAuthState);
			asMock(oauthStateRepo.markAsExchanged).mockResolvedValue({});
			accountRepo.findByProviderAccountId.mockResolvedValue(null);
			asMock(accountRepo.createOAuthAccount).mockResolvedValue({});
			asMock(securityLogRepo.create).mockResolvedValue({});
			uow.run.mockImplementation((work) => work());

			// When
			const result = await service.linkAccountWithExchangeCode(
				"any-user-789",
				"legacy-exchange-code",
				mockMetadata,
			);

			// Then
			expect(result).toEqual({ message: "계정이 연결되었습니다." });
		});
	});
});
