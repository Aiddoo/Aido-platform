import { Test, type TestingModule } from "@nestjs/testing";

import { TypedConfigService } from "@/common/config/services/config.service";
import { BusinessException } from "@/common/exception/services/business-exception.service";
import { DatabaseService } from "@/database";
import type { Account, User } from "@/generated/prisma/client";

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

describe("OAuthService", () => {
	let service: OAuthService;

	// Mock 객체들
	const mockDatabase = {
		$transaction: jest.fn((callback) =>
			callback({
				userConsent: { create: jest.fn() },
			}),
		),
	};

	const mockUserRepository = {
		findByEmail: jest.fn(),
		findById: jest.fn(),
		findByIdWithProfile: jest.fn(),
		create: jest.fn(),
		createProfile: jest.fn(),
	};

	const mockAccountRepository = {
		findByProviderAccountId: jest.fn(),
		findByUserIdAndProvider: jest.fn(),
		findAllByUserId: jest.fn(),
		createOAuthAccount: jest.fn(),
		deleteAccount: jest.fn(),
	};

	const mockSessionRepository = {
		create: jest.fn(),
		updateRefreshTokenHash: jest.fn(),
	};

	const mockSecurityLogRepository = {
		create: jest.fn(),
	};

	const mockLoginAttemptRepository = {
		create: jest.fn(),
		countRecentFailuresByEmail: jest.fn(),
		countRecentFailuresByIp: jest.fn(),
	};

	const mockTokenService = {
		generateTokenPair: jest.fn(),
		generateTokenFamily: jest.fn(),
		hashRefreshToken: jest.fn(),
		getRefreshTokenExpiresInSeconds: jest.fn(),
	};

	const mockTokenVerifier = {
		verifyAppleToken: jest.fn(),
		verifyGoogleToken: jest.fn(),
		verifyKakaoToken: jest.fn(),
		verifyNaverToken: jest.fn(),
	};

	const mockConfigService = {
		kakaoOAuth: {
			clientId: "test-kakao-client-id",
			clientSecret: "test-kakao-client-secret",
			callbackUrl: "http://localhost:3000/v1/auth/kakao/web-callback",
			isConfigured: true,
		},
		googleOAuth: {
			clientId: "test-google-client-id",
			clientSecret: "test-google-client-secret",
			callbackUrl: "http://localhost:3000/v1/auth/google/web-callback",
			isConfigured: true,
		},
		naverOAuth: {
			clientId: "test-naver-client-id",
			clientSecret: "test-naver-client-secret",
			callbackUrl: "http://localhost:3000/v1/auth/naver/web-callback",
			isConfigured: true,
		},
	};

	const mockOAuthStateRepository = {
		create: jest.fn(),
		findByState: jest.fn(),
		findByExchangeCode: jest.fn(),
		saveExchangeData: jest.fn(),
		markAsExchanged: jest.fn(),
	};

	beforeEach(async () => {
		jest.clearAllMocks();

		const module: TestingModule = await Test.createTestingModule({
			providers: [
				OAuthService,
				{ provide: DatabaseService, useValue: mockDatabase },
				{ provide: UserRepository, useValue: mockUserRepository },
				{ provide: AccountRepository, useValue: mockAccountRepository },
				{ provide: SessionRepository, useValue: mockSessionRepository },
				{ provide: SecurityLogRepository, useValue: mockSecurityLogRepository },
				{
					provide: LoginAttemptRepository,
					useValue: mockLoginAttemptRepository,
				},
				{ provide: TokenService, useValue: mockTokenService },
				{ provide: OAuthTokenVerifierService, useValue: mockTokenVerifier },
				{ provide: TypedConfigService, useValue: mockConfigService },
				{ provide: OAuthStateRepository, useValue: mockOAuthStateRepository },
			],
		}).compile();

		service = module.get<OAuthService>(OAuthService);
	});

	// ============================================
	// handleAppleMobileLogin (서버에서 토큰 검증)
	// ============================================

	describe("handleAppleMobileLogin", () => {
		const appleVerifiedProfile: AppleVerifiedProfile = {
			id: "apple-user-123",
			email: "test@privaterelay.appleid.com",
			emailVerified: true,
		};

		const mockUser: Partial<User> = {
			id: "user-123",
			email: "test@privaterelay.appleid.com",
			status: "ACTIVE",
			emailVerifiedAt: new Date(),
			createdAt: new Date(),
			updatedAt: new Date(),
		};

		const mockSession = {
			id: "session-123",
			userId: "user-123",
			tokenFamily: "family-123",
			tokenVersion: 1,
		};

		const mockTokens = {
			accessToken: "access-token",
			refreshToken: "refresh-token",
		};

		beforeEach(() => {
			mockTokenService.generateTokenFamily.mockReturnValue("family-123");
			mockTokenService.getRefreshTokenExpiresInSeconds.mockReturnValue(
				7 * 24 * 60 * 60,
			);
			mockTokenService.generateTokenPair.mockResolvedValue(mockTokens);
			mockTokenService.hashRefreshToken.mockReturnValue("hashed-refresh-token");
			mockSessionRepository.create.mockResolvedValue(mockSession);
			mockSessionRepository.updateRefreshTokenHash.mockResolvedValue({});
			mockSecurityLogRepository.create.mockResolvedValue({});
			mockUserRepository.findByIdWithProfile.mockResolvedValue({
				...mockUser,
				profile: { name: "홍길동", profileImage: null },
			});
			// 토큰 검증 mock
			mockTokenVerifier.verifyAppleToken.mockResolvedValue(
				appleVerifiedProfile,
			);
		});

		it("기존 Apple 사용자가 모바일 로그인하면 토큰을 발급한다", async () => {
			// Given
			const existingAccount: Partial<Account> = {
				userId: "user-123",
				provider: "APPLE",
				providerAccountId: "apple-user-123",
			};
			mockAccountRepository.findByProviderAccountId.mockResolvedValue(
				existingAccount,
			);
			mockUserRepository.findById.mockResolvedValue(mockUser);

			// When
			const result = await service.handleAppleMobileLogin("valid-id-token");

			// Then
			expect(result).toEqual({
				userId: "user-123",
				tokens: mockTokens,
				sessionId: "session-123",
				name: "홍길동",
				profileImage: null,
			});
			expect(mockTokenVerifier.verifyAppleToken).toHaveBeenCalledWith(
				"valid-id-token",
			);
			expect(
				mockAccountRepository.findByProviderAccountId,
			).toHaveBeenCalledWith("APPLE", "apple-user-123");
			expect(mockUserRepository.create).not.toHaveBeenCalled();
		});

		it("신규 Apple 사용자는 자동 회원가입 후 토큰을 발급한다", async () => {
			// Given
			mockAccountRepository.findByProviderAccountId.mockResolvedValue(null);
			mockUserRepository.findByEmail.mockResolvedValue(null);
			mockUserRepository.create.mockResolvedValue(mockUser);
			mockAccountRepository.createOAuthAccount.mockResolvedValue({});
			mockUserRepository.createProfile.mockResolvedValue({});

			// When
			const result = await service.handleAppleMobileLogin(
				"valid-id-token",
				"홍길동", // userName
			);

			// Then
			expect(result.userId).toBe("user-123");
			expect(result.tokens).toEqual(mockTokens);
			expect(mockUserRepository.create).toHaveBeenCalledWith(
				expect.objectContaining({
					email: "test@privaterelay.appleid.com",
					status: "ACTIVE",
				}),
				expect.anything(),
			);
			expect(mockAccountRepository.createOAuthAccount).toHaveBeenCalledWith(
				expect.objectContaining({
					userId: "user-123",
					provider: "APPLE",
					providerAccountId: "apple-user-123",
				}),
				expect.anything(),
			);
			expect(mockSecurityLogRepository.create).toHaveBeenCalledWith(
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
			mockTokenVerifier.verifyAppleToken.mockResolvedValue(profileWithoutEmail);
			mockAccountRepository.findByProviderAccountId.mockResolvedValue(null);
			mockUserRepository.create.mockResolvedValue({
				id: "new-user-id",
				email: "apple_apple-user-456@social.aido.app",
			});
			mockAccountRepository.createOAuthAccount.mockResolvedValue({
				id: "new-account-id",
			});
			mockSessionRepository.create.mockResolvedValue({
				id: "session-id",
			});
			mockTokenService.generateTokenPair.mockReturnValue({
				accessToken: "access",
				refreshToken: "refresh",
			});

			// When
			const result = await service.handleAppleMobileLogin("valid-id-token");

			// Then
			expect(result.tokens).toHaveProperty("accessToken");
			expect(mockUserRepository.create).toHaveBeenCalledWith(
				expect.objectContaining({
					email: "apple_apple-user-456@social.aido.app",
				}),
				expect.anything(), // 트랜잭션 클라이언트
			);
		});

		it("이메일이 이미 존재하는 경우 자동 연동된다 (Apple은 신뢰된 Provider)", async () => {
			// Given
			const existingUserWithSameEmail = {
				id: "other-user",
				email: "test@privaterelay.appleid.com",
				status: "ACTIVE",
			};
			mockAccountRepository.findByProviderAccountId.mockResolvedValue(null);
			mockUserRepository.findByEmail.mockResolvedValue(
				existingUserWithSameEmail,
			);
			mockAccountRepository.createOAuthAccount.mockResolvedValue({});
			mockUserRepository.findByIdWithProfile.mockResolvedValue({
				...existingUserWithSameEmail,
				profile: { name: "기존유저", profileImage: null },
			});

			// When
			const result = await service.handleAppleMobileLogin("valid-id-token");

			// Then - Apple은 신뢰된 Provider이므로 자동 연동됨
			expect(result.userId).toBe("other-user");
			expect(mockAccountRepository.createOAuthAccount).toHaveBeenCalledWith(
				expect.objectContaining({
					userId: "other-user",
					provider: "APPLE",
					providerAccountId: "apple-user-123",
				}),
				expect.anything(),
			);
			expect(mockSecurityLogRepository.create).toHaveBeenCalledWith(
				expect.objectContaining({
					event: SECURITY_EVENT.OAUTH_AUTO_LINKED,
				}),
				expect.anything(),
			);
		});

		it("계정이 잠긴 사용자는 로그인할 수 없다", async () => {
			// Given
			const lockedUser = { ...mockUser, status: "LOCKED" };
			mockAccountRepository.findByProviderAccountId.mockResolvedValue({
				userId: "user-123",
				provider: "APPLE",
				providerAccountId: "apple-user-123",
			});
			mockUserRepository.findById.mockResolvedValue(lockedUser);

			// When & Then
			await expect(
				service.handleAppleMobileLogin("valid-id-token"),
			).rejects.toThrow(BusinessException);
		});

		it("정지된 사용자는 로그인할 수 없다", async () => {
			// Given
			const suspendedUser = { ...mockUser, status: "SUSPENDED" };
			mockAccountRepository.findByProviderAccountId.mockResolvedValue({
				userId: "user-123",
				provider: "APPLE",
				providerAccountId: "apple-user-123",
			});
			mockUserRepository.findById.mockResolvedValue(suspendedUser);

			// When & Then
			await expect(
				service.handleAppleMobileLogin("valid-id-token"),
			).rejects.toThrow(BusinessException);
		});
	});

	// ============================================
	// linkAccount
	// ============================================

	describe("linkAccount", () => {
		it("새로운 소셜 계정을 연결한다", async () => {
			// Given
			mockAccountRepository.findByProviderAccountId.mockResolvedValue(null);
			mockAccountRepository.createOAuthAccount.mockResolvedValue({});

			// When
			const result = await service.linkAccount(
				"user-123",
				"APPLE",
				"apple-account-456",
			);

			// Then
			expect(result).toEqual({ message: "계정이 연결되었습니다." });
			expect(mockAccountRepository.createOAuthAccount).toHaveBeenCalledWith({
				userId: "user-123",
				provider: "APPLE",
				providerAccountId: "apple-account-456",
				refreshToken: undefined,
			});
		});

		it("이미 연결된 계정은 메시지를 반환한다", async () => {
			// Given
			mockAccountRepository.findByProviderAccountId.mockResolvedValue({
				userId: "user-123",
				provider: "APPLE",
				providerAccountId: "apple-account-456",
			});

			// When
			const result = await service.linkAccount(
				"user-123",
				"APPLE",
				"apple-account-456",
			);

			// Then
			expect(result).toEqual({ message: "이미 연결된 계정입니다." });
			expect(mockAccountRepository.createOAuthAccount).not.toHaveBeenCalled();
		});

		it("다른 사용자에 연결된 계정은 에러를 발생시킨다", async () => {
			// Given
			mockAccountRepository.findByProviderAccountId.mockResolvedValue({
				userId: "other-user-789",
				provider: "APPLE",
				providerAccountId: "apple-account-456",
			});

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
			// Given
			mockAccountRepository.findByUserIdAndProvider.mockResolvedValue({
				userId: "user-123",
				provider: "APPLE",
				providerAccountId: "apple-account-456",
			});
			mockAccountRepository.findAllByUserId.mockResolvedValue([
				{ provider: "APPLE" },
				{ provider: "CREDENTIAL" },
			]);
			mockAccountRepository.deleteAccount.mockResolvedValue({});

			// When
			const result = await service.unlinkAccount("user-123", "APPLE");

			// Then
			expect(result).toEqual({ message: "계정 연결이 해제되었습니다." });
			expect(mockAccountRepository.deleteAccount).toHaveBeenCalledWith(
				"user-123",
				"APPLE",
			);
		});

		it("연결되지 않은 계정은 에러를 발생시킨다", async () => {
			// Given
			mockAccountRepository.findByUserIdAndProvider.mockResolvedValue(null);

			// When & Then
			await expect(service.unlinkAccount("user-123", "APPLE")).rejects.toThrow(
				BusinessException,
			);
		});

		it("마지막 로그인 수단은 해제할 수 없다", async () => {
			// Given
			mockAccountRepository.findByUserIdAndProvider.mockResolvedValue({
				userId: "user-123",
				provider: "APPLE",
				providerAccountId: "apple-account-456",
			});
			mockAccountRepository.findAllByUserId.mockResolvedValue([
				{ provider: "APPLE" },
			]);

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
			// Given
			const linkedAt = new Date("2024-01-15");
			mockAccountRepository.findAllByUserId.mockResolvedValue([
				{ provider: "APPLE", createdAt: linkedAt },
				{ provider: "CREDENTIAL", createdAt: linkedAt },
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
			// Given
			const linkedAt = new Date("2024-01-15");
			mockAccountRepository.findAllByUserId.mockResolvedValue([
				{ provider: "CREDENTIAL", createdAt: linkedAt },
			]);

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
			mockConfigService.kakaoOAuth.isConfigured = false;

			// When & Then
			expect(() => service.generateKakaoAuthUrl("test-state")).toThrow(
				BusinessException,
			);

			// Cleanup
			mockConfigService.kakaoOAuth.isConfigured = true;
		});

		it("clientId가 없으면 에러를 발생시킨다", () => {
			// Given
			const originalClientId = mockConfigService.kakaoOAuth.clientId;
			mockConfigService.kakaoOAuth.clientId = undefined as unknown as string;

			// When & Then
			expect(() => service.generateKakaoAuthUrl("test-state")).toThrow(
				BusinessException,
			);

			// Cleanup
			mockConfigService.kakaoOAuth.clientId = originalClientId;
		});

		it("callbackUrl이 없으면 에러를 발생시킨다", () => {
			// Given
			const originalCallbackUrl = mockConfigService.kakaoOAuth.callbackUrl;
			mockConfigService.kakaoOAuth.callbackUrl = undefined as unknown as string;

			// When & Then
			expect(() => service.generateKakaoAuthUrl("test-state")).toThrow(
				BusinessException,
			);

			// Cleanup
			mockConfigService.kakaoOAuth.callbackUrl = originalCallbackUrl;
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

				// When
				await service.generateKakaoAuthUrlWithState(testState, redirectUri);

				// Then
				expect(mockOAuthStateRepository.create).toHaveBeenCalledWith(
					testState,
					"KAKAO",
					redirectUri, // 검증 통과하여 원본 URI 유지
				);
			});

			it("aido-dev://auth/google을 허용한다", async () => {
				// Given
				const redirectUri = "aido-dev://auth/google";

				// When
				await service.generateGoogleAuthUrlWithState(testState, redirectUri);

				// Then
				expect(mockOAuthStateRepository.create).toHaveBeenCalledWith(
					testState,
					"GOOGLE",
					redirectUri,
				);
			});

			it("aido-dev://auth/naver를 허용한다", async () => {
				// Given
				const redirectUri = "aido-dev://auth/naver";

				// When
				await service.generateNaverAuthUrlWithState(testState, redirectUri);

				// Then
				expect(mockOAuthStateRepository.create).toHaveBeenCalledWith(
					testState,
					"NAVER",
					redirectUri,
				);
			});

			it.skip("aido-dev://auth/apple을 허용한다", async () => {
				// Given
				const redirectUri = "aido-dev://auth/apple";

				// When
				// Apple은 URL 생성 메서드가 없으므로 테스트 스킵
				// await service.generateAppleAuthUrl(testState, redirectUri);

				// Then
				expect(mockOAuthStateRepository.create).toHaveBeenCalledWith(
					testState,
					"APPLE",
					redirectUri,
				);
			});

			it("aido-dev://auth/callback을 허용한다", async () => {
				// Given
				const redirectUri = "aido-dev://auth/callback";

				// When
				await service.generateKakaoAuthUrlWithState(testState, redirectUri);

				// Then
				expect(mockOAuthStateRepository.create).toHaveBeenCalledWith(
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

				// When
				await service.generateKakaoAuthUrlWithState(testState, redirectUri);

				// Then
				expect(mockOAuthStateRepository.create).toHaveBeenCalledWith(
					testState,
					"KAKAO",
					redirectUri,
				);
			});

			it("aido://auth/callback을 허용한다", async () => {
				// Given
				const redirectUri = "aido://auth/callback";

				// When
				await service.generateKakaoAuthUrlWithState(testState, redirectUri);

				// Then
				expect(mockOAuthStateRepository.create).toHaveBeenCalledWith(
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

				// When
				await service.generateKakaoAuthUrlWithState(testState, invalidUri);

				// Then
				expect(mockOAuthStateRepository.create).toHaveBeenCalledWith(
					testState,
					"KAKAO",
					"aido://auth/callback", // 기본값으로 대체
				);
			});

			it("잘못된 경로는 기본값으로 대체된다", async () => {
				// Given
				const invalidUri = "aido://wrong/path";

				// When
				await service.generateKakaoAuthUrlWithState(testState, invalidUri);

				// Then
				expect(mockOAuthStateRepository.create).toHaveBeenCalledWith(
					testState,
					"KAKAO",
					"aido://auth/callback",
				);
			});

			it("URI가 제공되지 않으면 기본값을 사용한다", async () => {
				// When
				await service.generateKakaoAuthUrlWithState(testState);

				// Then
				expect(mockOAuthStateRepository.create).toHaveBeenCalledWith(
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
		const mockKakaoProfile = {
			id: "kakao-user-123",
			email: "test@kakao.com",
			emailVerified: true,
			name: "카카오사용자",
			picture: "https://kakao.com/profile.jpg",
		};

		const mockUser: Partial<User> = {
			id: "user-123",
			email: "test@kakao.com",
			status: "ACTIVE",
			emailVerifiedAt: new Date(),
			createdAt: new Date(),
			updatedAt: new Date(),
		};

		const mockSession = {
			id: "session-123",
			userId: "user-123",
			tokenFamily: "family-123",
			tokenVersion: 1,
		};

		const mockTokens = {
			accessToken: "jwt-access-token",
			refreshToken: "jwt-refresh-token",
		};

		beforeEach(() => {
			mockTokenService.generateTokenFamily.mockReturnValue("family-123");
			mockTokenService.getRefreshTokenExpiresInSeconds.mockReturnValue(
				7 * 24 * 60 * 60,
			);
			mockTokenService.generateTokenPair.mockResolvedValue(mockTokens);
			mockTokenService.hashRefreshToken.mockReturnValue("hashed-refresh-token");
			mockSessionRepository.create.mockResolvedValue(mockSession);
			mockSessionRepository.updateRefreshTokenHash.mockResolvedValue({});
			mockSecurityLogRepository.create.mockResolvedValue({});
			mockUserRepository.findByIdWithProfile.mockResolvedValue({
				...mockUser,
				profile: {
					name: "카카오사용자",
					profileImage: "https://kakao.com/profile.jpg",
				},
			});
			mockTokenVerifier.verifyKakaoToken.mockResolvedValue(mockKakaoProfile);

			// Reset config to valid state
			mockConfigService.kakaoOAuth.isConfigured = true;
			mockConfigService.kakaoOAuth.clientId = "test-kakao-client-id";
			mockConfigService.kakaoOAuth.clientSecret = "test-kakao-client-secret";
			mockConfigService.kakaoOAuth.callbackUrl =
				"http://localhost:3000/v1/auth/kakao/web-callback";
		});

		it("authorization code를 토큰으로 교환하고 로그인 결과를 반환한다", async () => {
			// Given
			const existingAccount: Partial<Account> = {
				userId: "user-123",
				provider: "KAKAO",
				providerAccountId: "kakao-user-123",
			};
			mockAccountRepository.findByProviderAccountId.mockResolvedValue(
				existingAccount,
			);
			mockUserRepository.findById.mockResolvedValue(mockUser);

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

			expect(mockTokenVerifier.verifyKakaoToken).toHaveBeenCalledWith(
				"kakao-access-token",
			);
		});

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
			mockConfigService.kakaoOAuth.isConfigured = false;

			// When & Then
			await expect(
				service.handleKakaoWebCallback("test-auth-code"),
			).rejects.toThrow(BusinessException);

			// Cleanup
			mockConfigService.kakaoOAuth.isConfigured = true;
		});

		it("clientSecret이 없으면 에러를 발생시킨다", async () => {
			// Given
			mockConfigService.kakaoOAuth.clientSecret =
				undefined as unknown as string;

			// When & Then
			await expect(
				service.handleKakaoWebCallback("test-auth-code"),
			).rejects.toThrow(BusinessException);

			// Cleanup
			mockConfigService.kakaoOAuth.clientSecret = "test-kakao-client-secret";
		});

		it("신규 사용자일 경우 회원가입 후 토큰을 발급한다", async () => {
			// Given
			mockAccountRepository.findByProviderAccountId.mockResolvedValue(null);
			mockUserRepository.findByEmail.mockResolvedValue(null);
			mockUserRepository.create.mockResolvedValue(mockUser);
			mockAccountRepository.createOAuthAccount.mockResolvedValue({});
			mockUserRepository.createProfile.mockResolvedValue({});

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
			expect(mockUserRepository.create).toHaveBeenCalled();
			expect(mockAccountRepository.createOAuthAccount).toHaveBeenCalledWith(
				expect.objectContaining({
					userId: "user-123",
					provider: "KAKAO",
					providerAccountId: "kakao-user-123",
				}),
				expect.anything(),
			);
		});
	});

	// ============================================
	// LoginAttempt 기록 테스트
	// ============================================

	describe("LoginAttempt 기록", () => {
		const mockUser: Partial<User> = {
			id: "user-123",
			email: "test@example.com",
			status: "ACTIVE",
			emailVerifiedAt: new Date(),
			createdAt: new Date(),
			updatedAt: new Date(),
		};

		const mockSession = {
			id: "session-123",
			userId: "user-123",
			tokenFamily: "family-123",
			tokenVersion: 1,
		};

		const mockTokens = {
			accessToken: "access-token",
			refreshToken: "refresh-token",
		};

		const mockMetadata = {
			ip: "192.168.1.1",
			userAgent: "Test-User-Agent/1.0",
		};

		beforeEach(() => {
			mockTokenService.generateTokenFamily.mockReturnValue("family-123");
			mockTokenService.getRefreshTokenExpiresInSeconds.mockReturnValue(
				7 * 24 * 60 * 60,
			);
			mockTokenService.generateTokenPair.mockResolvedValue(mockTokens);
			mockTokenService.hashRefreshToken.mockReturnValue("hashed-refresh-token");
			mockSessionRepository.create.mockResolvedValue(mockSession);
			mockSessionRepository.updateRefreshTokenHash.mockResolvedValue({});
			mockSecurityLogRepository.create.mockResolvedValue({});
			mockLoginAttemptRepository.create.mockResolvedValue({});
			mockUserRepository.findByIdWithProfile.mockResolvedValue({
				...mockUser,
				profile: { name: "테스트유저", profileImage: null },
			});
		});

		describe("Apple 로그인", () => {
			it("Apple 토큰 검증 실패 시 LoginAttempt 실패 기록", async () => {
				// Given
				mockTokenVerifier.verifyAppleToken.mockRejectedValue(
					new Error("Invalid token"),
				);

				// When & Then
				await expect(
					service.handleAppleMobileLogin(
						"invalid-token",
						undefined,
						mockMetadata,
					),
				).rejects.toThrow();

				expect(mockLoginAttemptRepository.create).toHaveBeenCalledWith({
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
				const appleProfile = {
					id: "apple-user-123",
					email: "test@privaterelay.appleid.com",
					emailVerified: true,
				};
				mockTokenVerifier.verifyAppleToken.mockResolvedValue(appleProfile);
				mockAccountRepository.findByProviderAccountId.mockResolvedValue({
					userId: "user-123",
					provider: "APPLE",
					providerAccountId: "apple-user-123",
				});
				mockUserRepository.findById.mockResolvedValue(mockUser);

				// When
				await service.handleAppleMobileLogin(
					"valid-token",
					undefined,
					mockMetadata,
				);

				// Then
				expect(mockLoginAttemptRepository.create).toHaveBeenCalledWith(
					expect.objectContaining({
						email: mockUser.email,
						provider: "APPLE",
						ipAddress: mockMetadata.ip,
						userAgent: mockMetadata.userAgent,
						success: true,
					}),
					expect.anything(), // 트랜잭션 클라이언트
				);
			});
		});

		describe("Google 로그인", () => {
			it("Google 토큰 검증 실패 시 LoginAttempt 실패 기록", async () => {
				// Given
				mockTokenVerifier.verifyGoogleToken.mockRejectedValue(
					new Error("Invalid token"),
				);

				// When & Then
				await expect(
					service.handleGoogleMobileLogin(
						"invalid-token",
						undefined,
						mockMetadata,
					),
				).rejects.toThrow();

				expect(mockLoginAttemptRepository.create).toHaveBeenCalledWith({
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
				const googleProfile = {
					id: "google-user-123",
					email: "test@gmail.com",
					emailVerified: true,
					name: "Test User",
					picture: "https://example.com/photo.jpg",
				};
				mockTokenVerifier.verifyGoogleToken.mockResolvedValue(googleProfile);
				mockAccountRepository.findByProviderAccountId.mockResolvedValue({
					userId: "user-123",
					provider: "GOOGLE",
					providerAccountId: "google-user-123",
				});
				mockUserRepository.findById.mockResolvedValue({
					...mockUser,
					email: "test@gmail.com",
				});

				// When
				await service.handleGoogleMobileLogin(
					"valid-token",
					undefined,
					mockMetadata,
				);

				// Then
				expect(mockLoginAttemptRepository.create).toHaveBeenCalledWith(
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
				mockTokenVerifier.verifyKakaoToken.mockRejectedValue(
					new Error("Invalid token"),
				);

				// When & Then
				await expect(
					service.handleKakaoMobileLogin(
						"invalid-token",
						undefined,
						mockMetadata,
					),
				).rejects.toThrow();

				expect(mockLoginAttemptRepository.create).toHaveBeenCalledWith({
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
				const kakaoProfile = {
					id: "kakao-user-123",
					email: "test@kakao.com",
					emailVerified: true,
					name: "테스트",
					picture: "https://kakao.com/photo.jpg",
				};
				mockTokenVerifier.verifyKakaoToken.mockResolvedValue(kakaoProfile);
				mockAccountRepository.findByProviderAccountId.mockResolvedValue({
					userId: "user-123",
					provider: "KAKAO",
					providerAccountId: "kakao-user-123",
				});
				mockUserRepository.findById.mockResolvedValue({
					...mockUser,
					email: "test@kakao.com",
				});

				// When
				await service.handleKakaoMobileLogin(
					"valid-token",
					undefined,
					mockMetadata,
				);

				// Then
				expect(mockLoginAttemptRepository.create).toHaveBeenCalledWith(
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
				mockTokenVerifier.verifyNaverToken.mockRejectedValue(
					new Error("Invalid token"),
				);

				// When & Then
				await expect(
					service.handleNaverMobileLogin(
						"invalid-token",
						undefined,
						mockMetadata,
					),
				).rejects.toThrow();

				expect(mockLoginAttemptRepository.create).toHaveBeenCalledWith({
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
				const naverProfile = {
					id: "naver-user-123",
					email: "test@naver.com",
					emailVerified: true,
					name: "테스트",
					picture: "https://naver.com/photo.jpg",
				};
				mockTokenVerifier.verifyNaverToken.mockResolvedValue(naverProfile);
				mockAccountRepository.findByProviderAccountId.mockResolvedValue({
					userId: "user-123",
					provider: "NAVER",
					providerAccountId: "naver-user-123",
				});
				mockUserRepository.findById.mockResolvedValue({
					...mockUser,
					email: "test@naver.com",
				});

				// When
				await service.handleNaverMobileLogin(
					"valid-token",
					undefined,
					mockMetadata,
				);

				// Then
				expect(mockLoginAttemptRepository.create).toHaveBeenCalledWith(
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
				mockTokenVerifier.verifyAppleToken.mockRejectedValue(
					new Error("Invalid token"),
				);

				// When & Then
				await expect(
					service.handleAppleMobileLogin("invalid-token"),
				).rejects.toThrow();

				expect(mockLoginAttemptRepository.create).toHaveBeenCalledWith({
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
		const mockMetadata = {
			ip: "127.0.0.1",
			userAgent: "TestAgent/1.0",
		};

		const mockUser: Partial<User> = {
			id: "existing-user-123",
			email: "test@example.com",
			status: "ACTIVE",
			emailVerifiedAt: new Date(),
			createdAt: new Date(),
			updatedAt: new Date(),
		};

		const mockSession = {
			id: "session-123",
			userId: "existing-user-123",
			tokenFamily: "family-123",
			tokenVersion: 1,
		};

		const mockTokens = {
			accessToken: "access-token",
			refreshToken: "refresh-token",
		};

		beforeEach(() => {
			mockTokenService.generateTokenFamily.mockReturnValue("family-123");
			mockTokenService.getRefreshTokenExpiresInSeconds.mockReturnValue(
				7 * 24 * 60 * 60,
			);
			mockTokenService.generateTokenPair.mockResolvedValue(mockTokens);
			mockTokenService.hashRefreshToken.mockReturnValue("hashed-refresh-token");
			mockSessionRepository.create.mockResolvedValue(mockSession);
			mockSessionRepository.updateRefreshTokenHash.mockResolvedValue({});
			mockSecurityLogRepository.create.mockResolvedValue({});
			mockUserRepository.findByIdWithProfile.mockResolvedValue({
				...mockUser,
				profile: { name: "테스트유저", profileImage: null },
			});
		});

		describe("Google (신뢰된 Provider)", () => {
			const googleProfile = {
				id: "google-user-456",
				email: "test@example.com",
				emailVerified: true,
				name: "Test User",
				picture: "https://example.com/photo.jpg",
			};

			it("이메일 검증된 Google 계정은 기존 사용자에 자동 연동된다", async () => {
				// Given
				mockTokenVerifier.verifyGoogleToken.mockResolvedValue(googleProfile);
				mockAccountRepository.findByProviderAccountId.mockResolvedValue(null);
				mockUserRepository.findByEmail.mockResolvedValue(mockUser);
				mockAccountRepository.createOAuthAccount.mockResolvedValue({});

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
				expect(mockAccountRepository.createOAuthAccount).toHaveBeenCalledWith(
					expect.objectContaining({
						userId: "existing-user-123",
						provider: "GOOGLE",
						providerAccountId: "google-user-456",
					}),
					expect.anything(),
				);

				// SecurityLog에 OAUTH_AUTO_LINKED 기록 확인
				expect(mockSecurityLogRepository.create).toHaveBeenCalledWith(
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
				expect(mockUserRepository.create).not.toHaveBeenCalled();
			});

			it("이메일 미검증된 Google 계정은 강제 연동 에러를 반환한다", async () => {
				// Given
				const unverifiedProfile = { ...googleProfile, emailVerified: false };
				mockTokenVerifier.verifyGoogleToken.mockResolvedValue(
					unverifiedProfile,
				);
				mockAccountRepository.findByProviderAccountId.mockResolvedValue(null);
				mockUserRepository.findByEmail.mockResolvedValue(mockUser);

				// When & Then
				await expect(
					service.handleGoogleMobileLogin(
						"valid-google-token",
						undefined,
						mockMetadata,
					),
				).rejects.toThrow(BusinessException);

				// SecurityLog에 OAUTH_LINK_REQUIRED 기록 확인
				expect(mockSecurityLogRepository.create).toHaveBeenCalledWith(
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
				expect(mockAccountRepository.createOAuthAccount).not.toHaveBeenCalled();
			});
		});

		describe("Apple (신뢰된 Provider)", () => {
			const appleProfile = {
				id: "apple-user-456",
				email: "test@example.com",
				emailVerified: true,
			};

			it("이메일 검증된 Apple 계정은 기존 사용자에 자동 연동된다", async () => {
				// Given
				mockTokenVerifier.verifyAppleToken.mockResolvedValue(appleProfile);
				mockAccountRepository.findByProviderAccountId.mockResolvedValue(null);
				mockUserRepository.findByEmail.mockResolvedValue(mockUser);
				mockAccountRepository.createOAuthAccount.mockResolvedValue({});

				// When
				const result = await service.handleAppleMobileLogin(
					"valid-apple-token",
					undefined,
					mockMetadata,
				);

				// Then
				expect(result.userId).toBe("existing-user-123");

				// 자동 연동 확인
				expect(mockAccountRepository.createOAuthAccount).toHaveBeenCalledWith(
					expect.objectContaining({
						userId: "existing-user-123",
						provider: "APPLE",
						providerAccountId: "apple-user-456",
					}),
					expect.anything(),
				);

				// SecurityLog에 OAUTH_AUTO_LINKED 기록 확인
				expect(mockSecurityLogRepository.create).toHaveBeenCalledWith(
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
			const kakaoProfile = {
				id: "kakao-user-456",
				email: "test@example.com",
				emailVerified: true,
				name: "카카오유저",
				picture: "https://kakao.com/photo.jpg",
			};

			it("Kakao 계정은 이메일 충돌 시 항상 강제 연동 에러를 반환한다", async () => {
				// Given
				mockTokenVerifier.verifyKakaoToken.mockResolvedValue(kakaoProfile);
				mockAccountRepository.findByProviderAccountId.mockResolvedValue(null);
				mockUserRepository.findByEmail.mockResolvedValue(mockUser);

				// When & Then
				await expect(
					service.handleKakaoMobileLogin(
						"valid-kakao-token",
						undefined,
						mockMetadata,
					),
				).rejects.toThrow(BusinessException);

				// SecurityLog에 OAUTH_LINK_REQUIRED 기록 확인
				expect(mockSecurityLogRepository.create).toHaveBeenCalledWith(
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
				expect(mockAccountRepository.createOAuthAccount).not.toHaveBeenCalled();
			});

			it("Kakao 이메일 미검증 시에도 강제 연동 에러를 반환한다", async () => {
				// Given
				const unverifiedProfile = { ...kakaoProfile, emailVerified: false };
				mockTokenVerifier.verifyKakaoToken.mockResolvedValue(unverifiedProfile);
				mockAccountRepository.findByProviderAccountId.mockResolvedValue(null);
				mockUserRepository.findByEmail.mockResolvedValue(mockUser);

				// When & Then
				await expect(
					service.handleKakaoMobileLogin(
						"valid-kakao-token",
						undefined,
						mockMetadata,
					),
				).rejects.toThrow(BusinessException);

				// untrusted_provider 이유로 기록
				expect(mockSecurityLogRepository.create).toHaveBeenCalledWith(
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
			const naverProfile = {
				id: "naver-user-456",
				email: "test@example.com",
				emailVerified: true,
				name: "네이버유저",
				picture: "https://naver.com/photo.jpg",
			};

			it("Naver 계정은 이메일 충돌 시 항상 강제 연동 에러를 반환한다", async () => {
				// Given
				mockTokenVerifier.verifyNaverToken.mockResolvedValue(naverProfile);
				mockAccountRepository.findByProviderAccountId.mockResolvedValue(null);
				mockUserRepository.findByEmail.mockResolvedValue(mockUser);

				// When & Then
				await expect(
					service.handleNaverMobileLogin(
						"valid-naver-token",
						undefined,
						mockMetadata,
					),
				).rejects.toThrow(BusinessException);

				// SecurityLog에 OAUTH_LINK_REQUIRED 기록 확인
				expect(mockSecurityLogRepository.create).toHaveBeenCalledWith(
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
				expect(mockAccountRepository.createOAuthAccount).not.toHaveBeenCalled();
			});
		});

		describe("잠긴/정지된 사용자", () => {
			const googleProfile = {
				id: "google-user-789",
				email: "locked@example.com",
				emailVerified: true,
				name: "Locked User",
				picture: null,
			};

			it("잠긴 사용자에게는 자동 연동되지 않는다", async () => {
				// Given
				const lockedUser = {
					...mockUser,
					email: "locked@example.com",
					status: "LOCKED",
				};
				mockTokenVerifier.verifyGoogleToken.mockResolvedValue(googleProfile);
				mockAccountRepository.findByProviderAccountId.mockResolvedValue(null);
				mockUserRepository.findByEmail.mockResolvedValue(lockedUser);

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
				// Given
				const suspendedUser = {
					...mockUser,
					email: "suspended@example.com",
					status: "SUSPENDED",
				};
				const suspendedProfile = {
					...googleProfile,
					email: "suspended@example.com",
				};
				mockTokenVerifier.verifyGoogleToken.mockResolvedValue(suspendedProfile);
				mockAccountRepository.findByProviderAccountId.mockResolvedValue(null);
				mockUserRepository.findByEmail.mockResolvedValue(suspendedUser);

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
