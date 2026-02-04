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

import type { Mocked } from "@suites/doubles.jest";
import { TestBed } from "@suites/unit";
import { AccountBuilder, SessionBuilder, UserBuilder } from "@test/builders";

import { TypedConfigService } from "@/common/config/services/config.service";
import { BusinessException } from "@/common/exception/services/business-exception.service";
import { DatabaseService } from "@/database";
import { TodoCategoryRepository } from "../../todo-category/todo-category.repository";
import {
	LOGIN_FAILURE_REASON,
	SECURITY_EVENT,
} from "../constants/auth.constants";
import { AccountRepository } from "../repositories/account.repository";
import { LoginAttemptRepository } from "../repositories/login-attempt.repository";
import { OAuthStateRepository } from "../repositories/oauth-state.repository";
import { SecurityLogRepository } from "../repositories/security-log.repository";
import { SessionRepository } from "../repositories/session.repository";
import { UserRepository } from "../repositories/user.repository";
import { OAuthService } from "./oauth.service";
import { OAuthTokenVerifierService } from "./oauth-token-verifier.service";
import { TokenService } from "./token.service";

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

// Transaction callback 타입
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type TransactionCallback = (tx: any) => Promise<any>;

describe("OAuthService", () => {
	let service: OAuthService;
	let database: Mocked<DatabaseService>;
	let userRepo: Mocked<UserRepository>;
	let accountRepo: Mocked<AccountRepository>;
	let sessionRepo: Mocked<SessionRepository>;
	let securityLogRepo: Mocked<SecurityLogRepository>;
	let loginAttemptRepo: Mocked<LoginAttemptRepository>;
	let oauthStateRepo: Mocked<OAuthStateRepository>;
	let todoCategoryRepo: Mocked<TodoCategoryRepository>;
	let tokenService: Mocked<TokenService>;
	let tokenVerifier: Mocked<OAuthTokenVerifierService>;
	let configService: Mocked<TypedConfigService>;

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
		database = unitRef.get(
			DatabaseService,
		) as unknown as Mocked<DatabaseService>;
		userRepo = unitRef.get(UserRepository) as unknown as Mocked<UserRepository>;
		accountRepo = unitRef.get(
			AccountRepository,
		) as unknown as Mocked<AccountRepository>;
		sessionRepo = unitRef.get(
			SessionRepository,
		) as unknown as Mocked<SessionRepository>;
		securityLogRepo = unitRef.get(
			SecurityLogRepository,
		) as unknown as Mocked<SecurityLogRepository>;
		loginAttemptRepo = unitRef.get(
			LoginAttemptRepository,
		) as unknown as Mocked<LoginAttemptRepository>;
		oauthStateRepo = unitRef.get(
			OAuthStateRepository,
		) as unknown as Mocked<OAuthStateRepository>;
		todoCategoryRepo = unitRef.get(
			TodoCategoryRepository,
		) as unknown as Mocked<TodoCategoryRepository>;
		tokenService = unitRef.get(TokenService) as unknown as Mocked<TokenService>;
		tokenVerifier = unitRef.get(
			OAuthTokenVerifierService,
		) as unknown as Mocked<OAuthTokenVerifierService>;
		configService = unitRef.get(
			TypedConfigService,
		) as unknown as Mocked<TypedConfigService>;

		// ConfigService 기본 설정
		setupDefaultConfigService();
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
		const mockSession = SessionBuilder.create(mockUser.id)
			.withId("session-123")
			.withTokenFamily("family-123")
			.build();

		tokenService.generateTokenFamily.mockReturnValue("family-123");
		tokenService.getRefreshTokenExpiresInSeconds.mockReturnValue(
			7 * 24 * 60 * 60,
		);
		tokenService.generateTokenPair.mockResolvedValue(mockTokens);
		tokenService.hashRefreshToken.mockReturnValue("hashed-refresh-token");
		sessionRepo.create.mockResolvedValue(mockSession);
		sessionRepo.updateRefreshTokenHash.mockResolvedValue(mockSession as never);
		securityLogRepo.create.mockResolvedValue({
			id: 1,
			userId: mockUser.id,
			event: "LOGIN_SUCCESS",
			ipAddress: mockMetadata.ip,
			userAgent: mockMetadata.userAgent,
			metadata: null,
			createdAt: new Date(),
		});
		loginAttemptRepo.create.mockResolvedValue({
			id: 1,
			email: mockUser.email,
			provider: null,
			success: true,
			failureReason: null,
			ipAddress: mockMetadata.ip,
			userAgent: mockMetadata.userAgent,
			createdAt: new Date(),
		});
		userRepo.findByIdWithProfile.mockResolvedValue({
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
		} as never);
		database.$transaction.mockImplementation(
			async (callback: TransactionCallback) => {
				const mockTx = {
					userConsent: { create: jest.fn() },
				};
				return callback(mockTx as never);
			},
		);
		// database.user에 접근할 수 있도록 mock 설정
		Object.defineProperty(database, "user", {
			value: {
				findUnique: jest.fn().mockResolvedValue({ role: "USER" }),
			},
			configurable: true,
			writable: true,
		});
	};

	// ============================================
	// handleAppleMobileLogin (서버에서 토큰 검증)
	// ============================================

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
				);
				expect(accountRepo.findByProviderAccountId).toHaveBeenCalledWith(
					"APPLE",
					"apple-user-123",
				);
				expect(userRepo.create).not.toHaveBeenCalled();
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
				accountRepo.createOAuthAccount.mockResolvedValue({} as any);
				userRepo.createProfile.mockResolvedValue({} as any);
				todoCategoryRepo.createMany.mockResolvedValue(2);

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
					expect.anything(),
				);
				expect(accountRepo.createOAuthAccount).toHaveBeenCalledWith(
					expect.objectContaining({
						userId: "user-123",
						provider: "APPLE",
						providerAccountId: "apple-user-123",
					}),
					expect.anything(),
				);
				expect(securityLogRepo.create).toHaveBeenCalledWith(
					expect.objectContaining({
						userId: "user-123",
						event: SECURITY_EVENT.REGISTRATION,
					}),
					expect.anything(),
				);
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
					.withEmail("apple_apple-user-456@social.aido.app")
					.verified()
					.build();

				setupSuccessfulOAuthLogin(mockUser);
				tokenVerifier.verifyAppleToken.mockResolvedValue(profileWithoutEmail);
				accountRepo.findByProviderAccountId.mockResolvedValue(null);
				userRepo.create.mockResolvedValue(mockUser);
				accountRepo.createOAuthAccount.mockResolvedValue({} as any);
				userRepo.createProfile.mockResolvedValue({} as any);
				todoCategoryRepo.createMany.mockResolvedValue(2);

				// When
				const result = await service.handleAppleMobileLogin("valid-id-token");

				// Then
				expect(result.tokens).toHaveProperty("accessToken");
				expect(userRepo.create).toHaveBeenCalledWith(
					expect.objectContaining({
						email: "apple_apple-user-456@social.aido.app",
					}),
					expect.anything(),
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
				accountRepo.createOAuthAccount.mockResolvedValue({} as any);
				userRepo.findByIdWithProfile.mockResolvedValue({
					...existingUser,
					profile: { name: "기존유저", profileImage: null },
				} as any);

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
					expect.anything(),
				);
				expect(securityLogRepo.create).toHaveBeenCalledWith(
					expect.objectContaining({
						event: SECURITY_EVENT.OAUTH_AUTO_LINKED,
					}),
					expect.anything(),
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
				loginAttemptRepo.create.mockResolvedValue({} as any);

				// When & Then
				await expect(
					service.handleAppleMobileLogin("valid-id-token"),
				).rejects.toThrow(BusinessException);
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
				loginAttemptRepo.create.mockResolvedValue({} as any);

				// When & Then
				await expect(
					service.handleAppleMobileLogin("valid-id-token"),
				).rejects.toThrow(BusinessException);
			});
		});
	});

	// ============================================
	// linkAccount
	// ============================================

	describe("linkAccount", () => {
		it("새로운 소셜 계정을 연결한다", async () => {
			// Given
			accountRepo.findByProviderAccountId.mockResolvedValue(null);
			accountRepo.createOAuthAccount.mockResolvedValue({} as any);

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

		it("다른 사용자에 연결된 계정은 에러를 발생시킨다", async () => {
			// Given - Builder로 다른 사용자의 계정 생성
			const otherUserAccount = AccountBuilder.create("other-user-789")
				.asApple("apple-account-456")
				.build();

			accountRepo.findByProviderAccountId.mockResolvedValue(otherUserAccount);

			// When & Then
			await expect(
				service.linkAccount("user-123", "APPLE", "apple-account-456"),
			).rejects.toThrow(BusinessException);
		});
	});

	// ============================================
	// unlinkAccount
	// ============================================

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
			accountRepo.deleteAccount.mockResolvedValue({} as any);

			// When
			const result = await service.unlinkAccount("user-123", "APPLE");

			// Then
			expect(result).toEqual({ message: "계정 연결이 해제되었습니다." });
			expect(accountRepo.deleteAccount).toHaveBeenCalledWith(
				"user-123",
				"APPLE",
			);
		});

		it("연결되지 않은 계정은 에러를 발생시킨다", async () => {
			// Given
			accountRepo.findByUserIdAndProvider.mockResolvedValue(null);

			// When & Then
			await expect(service.unlinkAccount("user-123", "APPLE")).rejects.toThrow(
				BusinessException,
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
				BusinessException,
			);
		});
	});

	// ============================================
	// getLinkedAccounts
	// ============================================

	describe("getLinkedAccounts", () => {
		it("연결된 소셜 계정 목록을 반환한다", async () => {
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

			// Then
			expect(result).toEqual([{ provider: "APPLE", linkedAt }]);
			expect(result).not.toContainEqual(
				expect.objectContaining({ provider: "CREDENTIAL" }),
			);
		});

		it("소셜 계정이 없으면 빈 배열을 반환한다", async () => {
			// Given - Builder로 Credential 계정만 생성
			const linkedAt = new Date("2024-01-15");
			const credentialAccount = AccountBuilder.create("user-123")
				.asCredential()
				.withCreatedAt(linkedAt)
				.build();

			accountRepo.findAllByUserId.mockResolvedValue([credentialAccount]);

			// When
			const result = await service.getLinkedAccounts("user-123");

			// Then
			expect(result).toEqual([]);
		});
	});

	// ============================================
	// generateKakaoAuthUrl (웹 OAuth URL 생성)
	// ============================================

	describe("generateKakaoAuthUrl", () => {
		it("올바른 Kakao OAuth 인증 URL을 생성한다", () => {
			// Given
			const state = "test-csrf-state-123";

			// When
			const result = service.generateKakaoAuthUrl(state);

			// Then
			expect(result).toContain("https://kauth.kakao.com/oauth/authorize");
			expect(result).toContain("client_id=test-kakao-client-id");
			expect(result).toContain(
				"redirect_uri=http%3A%2F%2Flocalhost%3A3000%2Fv1%2Fauth%2Fkakao%2Fweb-callback",
			);
			expect(result).toContain("response_type=code");
			expect(result).toContain("state=test-csrf-state-123");
			expect(result).toContain("scope=profile_nickname+profile_image");
		});

		it("Kakao OAuth가 설정되지 않으면 에러를 발생시킨다", () => {
			// Given
			Object.defineProperty(configService, "kakaoOAuth", {
				get: () => ({
					clientId: "test-kakao-client-id",
					clientSecret: "test-kakao-client-secret",
					callbackUrl: "http://localhost:3000/v1/auth/kakao/web-callback",
					isConfigured: false,
				}),
				configurable: true,
			});

			// When & Then
			expect(() => service.generateKakaoAuthUrl("test-state")).toThrow(
				BusinessException,
			);

			// Cleanup
			setupDefaultConfigService();
		});

		it("clientId가 없으면 에러를 발생시킨다", () => {
			// Given
			Object.defineProperty(configService, "kakaoOAuth", {
				get: () => ({
					clientId: undefined,
					clientSecret: "test-kakao-client-secret",
					callbackUrl: "http://localhost:3000/v1/auth/kakao/web-callback",
					isConfigured: true,
				}),
				configurable: true,
			});

			// When & Then
			expect(() => service.generateKakaoAuthUrl("test-state")).toThrow(
				BusinessException,
			);

			// Cleanup
			setupDefaultConfigService();
		});

		it("callbackUrl이 없으면 에러를 발생시킨다", () => {
			// Given
			Object.defineProperty(configService, "kakaoOAuth", {
				get: () => ({
					clientId: "test-kakao-client-id",
					clientSecret: "test-kakao-client-secret",
					callbackUrl: undefined,
					isConfigured: true,
				}),
				configurable: true,
			});

			// When & Then
			expect(() => service.generateKakaoAuthUrl("test-state")).toThrow(
				BusinessException,
			);

			// Cleanup
			setupDefaultConfigService();
		});
	});

	// ============================================
	// Redirect URI 검증 (개발/프로덕션 환경)
	// ============================================

	describe("Redirect URI 검증", () => {
		const testState = "test-state-123";

		describe("모바일 딥링크 - 개발 환경 (aido-dev://)", () => {
			it("aido-dev://auth/kakao를 허용한다", async () => {
				// Given
				const redirectUri = "aido-dev://auth/kakao";
				oauthStateRepo.create.mockResolvedValue({} as any);

				// When
				await service.generateKakaoAuthUrlWithState(testState, redirectUri);

				// Then
				expect(oauthStateRepo.create).toHaveBeenCalledWith(
					testState,
					"KAKAO",
					redirectUri,
				);
			});

			it("aido-dev://auth/google을 허용한다", async () => {
				// Given
				const redirectUri = "aido-dev://auth/google";
				oauthStateRepo.create.mockResolvedValue({} as any);

				// When
				await service.generateGoogleAuthUrlWithState(testState, redirectUri);

				// Then
				expect(oauthStateRepo.create).toHaveBeenCalledWith(
					testState,
					"GOOGLE",
					redirectUri,
				);
			});

			it("aido-dev://auth/naver를 허용한다", async () => {
				// Given
				const redirectUri = "aido-dev://auth/naver";
				oauthStateRepo.create.mockResolvedValue({} as any);

				// When
				await service.generateNaverAuthUrlWithState(testState, redirectUri);

				// Then
				expect(oauthStateRepo.create).toHaveBeenCalledWith(
					testState,
					"NAVER",
					redirectUri,
				);
			});

			// Note: Apple은 URL 기반 OAuth가 아닌 토큰 기반 모바일 로그인만 지원
			// handleAppleMobileLogin에서 redirectUri를 사용하지 않으므로 이 테스트 그룹에서 제외

			it("aido-dev://auth/callback을 허용한다", async () => {
				// Given
				const redirectUri = "aido-dev://auth/callback";
				oauthStateRepo.create.mockResolvedValue({} as any);

				// When
				await service.generateKakaoAuthUrlWithState(testState, redirectUri);

				// Then
				expect(oauthStateRepo.create).toHaveBeenCalledWith(
					testState,
					"KAKAO",
					redirectUri,
				);
			});
		});

		describe("모바일 딥링크 - 프로덕션 환경 (aido://)", () => {
			it("aido://auth/kakao를 허용한다", async () => {
				// Given
				const redirectUri = "aido://auth/kakao";
				oauthStateRepo.create.mockResolvedValue({} as any);

				// When
				await service.generateKakaoAuthUrlWithState(testState, redirectUri);

				// Then
				expect(oauthStateRepo.create).toHaveBeenCalledWith(
					testState,
					"KAKAO",
					redirectUri,
				);
			});

			it("aido://auth/callback을 허용한다", async () => {
				// Given
				const redirectUri = "aido://auth/callback";
				oauthStateRepo.create.mockResolvedValue({} as any);

				// When
				await service.generateKakaoAuthUrlWithState(testState, redirectUri);

				// Then
				expect(oauthStateRepo.create).toHaveBeenCalledWith(
					testState,
					"KAKAO",
					redirectUri,
				);
			});
		});

		describe("유효하지 않은 URI는 기본값으로 대체", () => {
			it("잘못된 scheme은 기본값으로 대체된다", async () => {
				// Given
				const invalidUri = "invalid-scheme://auth/kakao";
				oauthStateRepo.create.mockResolvedValue({} as any);

				// When
				await service.generateKakaoAuthUrlWithState(testState, invalidUri);

				// Then
				expect(oauthStateRepo.create).toHaveBeenCalledWith(
					testState,
					"KAKAO",
					"aido://auth/callback",
				);
			});

			it("잘못된 경로는 기본값으로 대체된다", async () => {
				// Given
				const invalidUri = "aido://wrong/path";
				oauthStateRepo.create.mockResolvedValue({} as any);

				// When
				await service.generateKakaoAuthUrlWithState(testState, invalidUri);

				// Then
				expect(oauthStateRepo.create).toHaveBeenCalledWith(
					testState,
					"KAKAO",
					"aido://auth/callback",
				);
			});

			it("URI가 제공되지 않으면 기본값을 사용한다", async () => {
				// Given
				oauthStateRepo.create.mockResolvedValue({} as any);

				// When
				await service.generateKakaoAuthUrlWithState(testState);

				// Then
				expect(oauthStateRepo.create).toHaveBeenCalledWith(
					testState,
					"KAKAO",
					"aido://auth/callback",
				);
			});
		});
	});

	// ============================================
	// handleKakaoWebCallback (Authorization Code → Token 교환)
	// ============================================

	describe("handleKakaoWebCallback", () => {
		const mockKakaoProfile: OAuthProfile = {
			id: "kakao-user-123",
			email: "test@kakao.com",
			emailVerified: true,
			name: "카카오사용자",
			picture: "https://kakao.com/profile.jpg",
		};

		describe("기존 사용자 로그인", () => {
			it("authorization code를 토큰으로 교환하고 로그인 결과를 반환한다", async () => {
				// Given - Builder로 테스트 데이터 생성
				const mockUser = UserBuilder.create()
					.withId("user-123")
					.withEmail("test@kakao.com")
					.verified()
					.build();

				const existingAccount = AccountBuilder.create(mockUser.id)
					.asKakao("kakao-user-123")
					.build();

				setupSuccessfulOAuthLogin(mockUser);
				userRepo.findByIdWithProfile.mockResolvedValue({
					...mockUser,
					profile: {
						name: "카카오사용자",
						profileImage: "https://kakao.com/profile.jpg",
					},
				} as any);
				tokenVerifier.verifyKakaoToken.mockResolvedValue(mockKakaoProfile);
				accountRepo.findByProviderAccountId.mockResolvedValue(existingAccount);
				userRepo.findById.mockResolvedValue(mockUser);

				// Mock fetch for token exchange
				const mockTokenResponse = {
					access_token: "kakao-access-token",
					token_type: "bearer",
					refresh_token: "kakao-refresh-token",
					expires_in: 21599,
				};
				global.fetch = jest.fn().mockResolvedValue({
					ok: true,
					json: () => Promise.resolve(mockTokenResponse),
				});

				// When
				const result = await service.handleKakaoWebCallback("test-auth-code");

				// Then
				expect(result).toEqual({
					userId: "user-123",
					userTag: mockUser.userTag,
					tokens: mockTokens,
					sessionId: "session-123",
					name: "카카오사용자",
					profileImage: "https://kakao.com/profile.jpg",
				});

				expect(global.fetch).toHaveBeenCalledWith(
					"https://kauth.kakao.com/oauth/token",
					expect.objectContaining({
						method: "POST",
						headers: {
							"Content-Type": "application/x-www-form-urlencoded",
						},
					}),
				);

				expect(tokenVerifier.verifyKakaoToken).toHaveBeenCalledWith(
					"kakao-access-token",
				);
			});
		});

		describe("에러 케이스", () => {
			it("토큰 교환 실패 시 에러를 발생시킨다", async () => {
				// Given
				global.fetch = jest.fn().mockResolvedValue({
					ok: false,
					text: () => Promise.resolve("Invalid authorization code"),
				});

				// When & Then
				await expect(
					service.handleKakaoWebCallback("invalid-auth-code"),
				).rejects.toThrow(BusinessException);
			});

			it("Kakao OAuth가 설정되지 않으면 에러를 발생시킨다", async () => {
				// Given
				Object.defineProperty(configService, "kakaoOAuth", {
					get: () => ({
						clientId: "test-kakao-client-id",
						clientSecret: "test-kakao-client-secret",
						callbackUrl: "http://localhost:3000/v1/auth/kakao/web-callback",
						isConfigured: false,
					}),
					configurable: true,
				});

				// When & Then
				await expect(
					service.handleKakaoWebCallback("test-auth-code"),
				).rejects.toThrow(BusinessException);

				// Cleanup
				setupDefaultConfigService();
			});

			it("clientSecret이 없으면 에러를 발생시킨다", async () => {
				// Given
				Object.defineProperty(configService, "kakaoOAuth", {
					get: () => ({
						clientId: "test-kakao-client-id",
						clientSecret: undefined,
						callbackUrl: "http://localhost:3000/v1/auth/kakao/web-callback",
						isConfigured: true,
					}),
					configurable: true,
				});

				// When & Then
				await expect(
					service.handleKakaoWebCallback("test-auth-code"),
				).rejects.toThrow(BusinessException);

				// Cleanup
				setupDefaultConfigService();
			});
		});

		describe("신규 사용자 회원가입", () => {
			it("신규 사용자일 경우 회원가입 후 토큰을 발급한다", async () => {
				// Given
				const mockUser = UserBuilder.create()
					.withId("user-123")
					.withEmail("test@kakao.com")
					.verified()
					.build();

				setupSuccessfulOAuthLogin(mockUser);
				tokenVerifier.verifyKakaoToken.mockResolvedValue(mockKakaoProfile);
				accountRepo.findByProviderAccountId.mockResolvedValue(null);
				userRepo.findByEmail.mockResolvedValue(null);
				userRepo.create.mockResolvedValue(mockUser);
				accountRepo.createOAuthAccount.mockResolvedValue({} as any);
				userRepo.createProfile.mockResolvedValue({} as any);
				todoCategoryRepo.createMany.mockResolvedValue(2);

				const mockTokenResponse = {
					access_token: "kakao-access-token",
					token_type: "bearer",
					refresh_token: "kakao-refresh-token",
					expires_in: 21599,
				};
				global.fetch = jest.fn().mockResolvedValue({
					ok: true,
					json: () => Promise.resolve(mockTokenResponse),
				});

				// When
				const result = await service.handleKakaoWebCallback("test-auth-code");

				// Then
				expect(result.userId).toBe("user-123");
				expect(result.tokens).toEqual(mockTokens);
				expect(userRepo.create).toHaveBeenCalled();
				expect(accountRepo.createOAuthAccount).toHaveBeenCalledWith(
					expect.objectContaining({
						userId: "user-123",
						provider: "KAKAO",
						providerAccountId: "kakao-user-123",
					}),
					expect.anything(),
				);
			});
		});
	});

	// ============================================
	// LoginAttempt 기록 테스트
	// ============================================

	describe("LoginAttempt 기록", () => {
		describe("Apple 로그인", () => {
			it("Apple 토큰 검증 실패 시 LoginAttempt 실패 기록", async () => {
				// Given
				tokenVerifier.verifyAppleToken.mockRejectedValue(
					new Error("Invalid token"),
				);
				loginAttemptRepo.create.mockResolvedValue({} as any);

				// When & Then
				await expect(
					service.handleAppleMobileLogin(
						"invalid-token",
						undefined,
						mockMetadata,
					),
				).rejects.toThrow();

				expect(loginAttemptRepo.create).toHaveBeenCalledWith({
					email: "apple_unknown@social.aido.app",
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
					expect.anything(),
				);
			});
		});

		describe("Google 로그인", () => {
			it("Google 토큰 검증 실패 시 LoginAttempt 실패 기록", async () => {
				// Given
				tokenVerifier.verifyGoogleToken.mockRejectedValue(
					new Error("Invalid token"),
				);
				loginAttemptRepo.create.mockResolvedValue({} as any);

				// When & Then
				await expect(
					service.handleGoogleMobileLogin(
						"invalid-token",
						undefined,
						mockMetadata,
					),
				).rejects.toThrow();

				expect(loginAttemptRepo.create).toHaveBeenCalledWith({
					email: "google_unknown@social.aido.app",
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
					expect.anything(),
				);
			});
		});

		describe("Kakao 로그인", () => {
			it("Kakao 토큰 검증 실패 시 LoginAttempt 실패 기록", async () => {
				// Given
				tokenVerifier.verifyKakaoToken.mockRejectedValue(
					new Error("Invalid token"),
				);
				loginAttemptRepo.create.mockResolvedValue({} as any);

				// When & Then
				await expect(
					service.handleKakaoMobileLogin(
						"invalid-token",
						undefined,
						mockMetadata,
					),
				).rejects.toThrow();

				expect(loginAttemptRepo.create).toHaveBeenCalledWith({
					email: "kakao_unknown@social.aido.app",
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
					expect.anything(),
				);
			});
		});

		describe("Naver 로그인", () => {
			it("Naver 토큰 검증 실패 시 LoginAttempt 실패 기록", async () => {
				// Given
				tokenVerifier.verifyNaverToken.mockRejectedValue(
					new Error("Invalid token"),
				);
				loginAttemptRepo.create.mockResolvedValue({} as any);

				// When & Then
				await expect(
					service.handleNaverMobileLogin(
						"invalid-token",
						undefined,
						mockMetadata,
					),
				).rejects.toThrow();

				expect(loginAttemptRepo.create).toHaveBeenCalledWith({
					email: "naver_unknown@social.aido.app",
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
					expect.anything(),
				);
			});
		});

		describe("메타데이터 기본값", () => {
			it("메타데이터가 없으면 기본값을 사용한다", async () => {
				// Given
				tokenVerifier.verifyAppleToken.mockRejectedValue(
					new Error("Invalid token"),
				);
				loginAttemptRepo.create.mockResolvedValue({} as any);

				// When & Then
				await expect(
					service.handleAppleMobileLogin("invalid-token"),
				).rejects.toThrow();

				expect(loginAttemptRepo.create).toHaveBeenCalledWith({
					email: "apple_unknown@social.aido.app",
					provider: "APPLE",
					ipAddress: "unknown",
					userAgent: "unknown",
					success: false,
					failureReason: LOGIN_FAILURE_REASON.OAUTH_TOKEN_INVALID,
				});
			});
		});
	});

	// ============================================
	// Provider별 자동/강제 연동 테스트
	// ============================================

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
				accountRepo.createOAuthAccount.mockResolvedValue({} as any);

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
					expect.anything(),
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
					expect.anything(),
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
				securityLogRepo.create.mockResolvedValue({} as any);
				loginAttemptRepo.create.mockResolvedValue({} as any);

				// When & Then
				await expect(
					service.handleGoogleMobileLogin(
						"valid-google-token",
						undefined,
						mockMetadata,
					),
				).rejects.toThrow(BusinessException);

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
				accountRepo.createOAuthAccount.mockResolvedValue({} as any);

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
					expect.anything(),
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
					expect.anything(),
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
				securityLogRepo.create.mockResolvedValue({} as any);
				loginAttemptRepo.create.mockResolvedValue({} as any);

				// When & Then
				await expect(
					service.handleKakaoMobileLogin(
						"valid-kakao-token",
						undefined,
						mockMetadata,
					),
				).rejects.toThrow(BusinessException);

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
				securityLogRepo.create.mockResolvedValue({} as any);
				loginAttemptRepo.create.mockResolvedValue({} as any);

				// When & Then
				await expect(
					service.handleKakaoMobileLogin(
						"valid-kakao-token",
						undefined,
						mockMetadata,
					),
				).rejects.toThrow(BusinessException);

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
				securityLogRepo.create.mockResolvedValue({} as any);
				loginAttemptRepo.create.mockResolvedValue({} as any);

				// When & Then
				await expect(
					service.handleNaverMobileLogin(
						"valid-naver-token",
						undefined,
						mockMetadata,
					),
				).rejects.toThrow(BusinessException);

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
				loginAttemptRepo.create.mockResolvedValue({} as any);

				// When & Then
				await expect(
					service.handleGoogleMobileLogin(
						"valid-google-token",
						undefined,
						mockMetadata,
					),
				).rejects.toThrow(BusinessException);
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
				loginAttemptRepo.create.mockResolvedValue({} as any);

				// When & Then
				await expect(
					service.handleGoogleMobileLogin(
						"valid-google-token",
						undefined,
						mockMetadata,
					),
				).rejects.toThrow(BusinessException);
			});
		});
	});
});
