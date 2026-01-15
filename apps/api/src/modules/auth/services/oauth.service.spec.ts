import { Test, type TestingModule } from "@nestjs/testing";

import { BusinessException } from "@/common/exception/services/business-exception.service";
import { DatabaseService } from "@/database";
import type { Account, User } from "@/generated/prisma/client";

import { SECURITY_EVENT } from "../constants/auth.constants";
import { AccountRepository } from "../repositories/account.repository";
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
				{ provide: TokenService, useValue: mockTokenService },
				{ provide: OAuthTokenVerifierService, useValue: mockTokenVerifier },
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

		it("이메일 없이 신규 로그인 시 에러를 발생시킨다", async () => {
			// Given
			const profileWithoutEmail: AppleVerifiedProfile = {
				id: "apple-user-456",
				email: null,
				emailVerified: false,
			};
			mockTokenVerifier.verifyAppleToken.mockResolvedValue(profileWithoutEmail);
			mockAccountRepository.findByProviderAccountId.mockResolvedValue(null);

			// When & Then
			await expect(
				service.handleAppleMobileLogin("valid-id-token"),
			).rejects.toThrow(BusinessException);
		});

		it("이메일이 이미 존재하는 경우 에러를 발생시킨다", async () => {
			// Given
			mockAccountRepository.findByProviderAccountId.mockResolvedValue(null);
			mockUserRepository.findByEmail.mockResolvedValue({
				id: "other-user",
				email: "test@privaterelay.appleid.com",
			});

			// When & Then
			await expect(
				service.handleAppleMobileLogin("valid-id-token"),
			).rejects.toThrow(BusinessException);
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
});
