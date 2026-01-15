import { ConfigService } from "@nestjs/config";
import { Test, type TestingModule } from "@nestjs/testing";

import { BusinessException } from "@/common/exception/services/business-exception.service";

import { OAuthTokenVerifierService } from "./oauth-token-verifier.service";

// Google Auth Library 모킹
jest.mock("google-auth-library", () => ({
	OAuth2Client: jest.fn().mockImplementation(() => ({
		verifyIdToken: jest.fn(),
	})),
}));

describe("OAuthTokenVerifierService", () => {
	let service: OAuthTokenVerifierService;
	let mockGoogleVerifyIdToken: jest.Mock;

	const mockConfig = {
		get: jest.fn((key: string) => {
			const config: Record<string, string> = {
				GOOGLE_CLIENT_ID: "google-client-id",
				APPLE_CLIENT_ID: "apple-client-id",
			};
			return config[key];
		}),
	};

	beforeEach(async () => {
		jest.clearAllMocks();

		// Google Auth Library mock 설정
		const { OAuth2Client } = jest.requireMock("google-auth-library");
		mockGoogleVerifyIdToken = jest.fn();
		OAuth2Client.mockImplementation(() => ({
			verifyIdToken: mockGoogleVerifyIdToken,
		}));

		const module: TestingModule = await Test.createTestingModule({
			providers: [
				OAuthTokenVerifierService,
				{ provide: ConfigService, useValue: mockConfig },
			],
		}).compile();

		service = module.get<OAuthTokenVerifierService>(OAuthTokenVerifierService);
	});

	// ============================================
	// verifyGoogleToken
	// ============================================

	describe("verifyGoogleToken", () => {
		const validGooglePayload = {
			sub: "google-user-123",
			email: "test@gmail.com",
			email_verified: true,
			name: "홍길동",
			picture: "https://lh3.googleusercontent.com/photo.jpg",
		};

		it("유효한 Google ID Token을 검증하면 프로필을 반환한다", async () => {
			// Given
			mockGoogleVerifyIdToken.mockResolvedValue({
				getPayload: () => validGooglePayload,
			});

			// When
			const result = await service.verifyGoogleToken("valid-google-token");

			// Then
			expect(result).toEqual({
				id: "google-user-123",
				email: "test@gmail.com",
				emailVerified: true,
				name: "홍길동",
				picture: "https://lh3.googleusercontent.com/photo.jpg",
			});
			expect(mockGoogleVerifyIdToken).toHaveBeenCalledWith({
				idToken: "valid-google-token",
				audience: "google-client-id",
			});
		});

		it("이메일이 없는 Google 프로필도 처리한다", async () => {
			// Given
			mockGoogleVerifyIdToken.mockResolvedValue({
				getPayload: () => ({
					sub: "google-user-456",
					email_verified: false,
				}),
			});

			// When
			const result = await service.verifyGoogleToken("valid-token");

			// Then
			expect(result).toEqual({
				id: "google-user-456",
				email: null,
				emailVerified: false,
				name: undefined,
				picture: undefined,
			});
		});

		it("payload가 없으면 에러를 발생시킨다", async () => {
			// Given
			mockGoogleVerifyIdToken.mockResolvedValue({
				getPayload: () => null,
			});

			// When & Then
			await expect(service.verifyGoogleToken("invalid-token")).rejects.toThrow(
				BusinessException,
			);
		});

		it("만료된 토큰은 socialTokenExpired 에러를 발생시킨다", async () => {
			// Given
			mockGoogleVerifyIdToken.mockRejectedValue(
				new Error("Token used too late, expired"),
			);

			// When & Then
			await expect(service.verifyGoogleToken("expired-token")).rejects.toThrow(
				BusinessException,
			);
		});

		it("잘못된 토큰은 socialTokenInvalid 에러를 발생시킨다", async () => {
			// Given
			mockGoogleVerifyIdToken.mockRejectedValue(new Error("Invalid signature"));

			// When & Then
			await expect(
				service.verifyGoogleToken("malformed-token"),
			).rejects.toThrow(BusinessException);
		});
	});

	// ============================================
	// verifyKakaoToken
	// ============================================

	describe("verifyKakaoToken", () => {
		const mockKakaoResponse = {
			id: 12345678,
			kakao_account: {
				email: "test@kakao.com",
				is_email_verified: true,
				profile: {
					nickname: "카카오유저",
					profile_image_url: "https://k.kakaocdn.net/dn/profile.jpg",
				},
			},
		};

		beforeEach(() => {
			global.fetch = jest.fn();
		});

		afterEach(() => {
			jest.restoreAllMocks();
		});

		it("유효한 Kakao access token을 검증하면 프로필을 반환한다", async () => {
			// Given
			(global.fetch as jest.Mock).mockResolvedValue({
				ok: true,
				json: () => Promise.resolve(mockKakaoResponse),
			});

			// When
			const result = await service.verifyKakaoToken("valid-kakao-token");

			// Then
			expect(result).toEqual({
				id: "12345678",
				email: "test@kakao.com",
				emailVerified: true,
				name: "카카오유저",
				picture: "https://k.kakaocdn.net/dn/profile.jpg",
			});
			expect(global.fetch).toHaveBeenCalledWith(
				"https://kapi.kakao.com/v2/user/me",
				expect.objectContaining({
					headers: {
						Authorization: "Bearer valid-kakao-token",
						"Content-Type": "application/x-www-form-urlencoded;charset=utf-8",
					},
				}),
			);
		});

		it("이메일이 없는 Kakao 계정도 처리한다", async () => {
			// Given
			(global.fetch as jest.Mock).mockResolvedValue({
				ok: true,
				json: () =>
					Promise.resolve({
						id: 87654321,
						kakao_account: {
							profile: {
								nickname: "닉네임만",
							},
						},
					}),
			});

			// When
			const result = await service.verifyKakaoToken("valid-token");

			// Then
			expect(result.email).toBeNull();
			expect(result.emailVerified).toBe(false);
		});

		it("401 응답은 socialTokenExpired 에러를 발생시킨다", async () => {
			// Given
			(global.fetch as jest.Mock).mockResolvedValue({
				ok: false,
				status: 401,
			});

			// When & Then
			await expect(service.verifyKakaoToken("expired-token")).rejects.toThrow(
				BusinessException,
			);
		});

		it("기타 에러 응답은 socialTokenInvalid 에러를 발생시킨다", async () => {
			// Given
			(global.fetch as jest.Mock).mockResolvedValue({
				ok: false,
				status: 400,
			});

			// When & Then
			await expect(service.verifyKakaoToken("invalid-token")).rejects.toThrow(
				BusinessException,
			);
		});
	});

	// ============================================
	// verifyNaverToken
	// ============================================

	describe("verifyNaverToken", () => {
		const mockNaverResponse = {
			resultcode: "00",
			message: "success",
			response: {
				id: "naver-user-123",
				email: "test@naver.com",
				name: "네이버유저",
				nickname: "네이버닉네임",
				profile_image: "https://phinf.pstatic.net/profile.jpg",
			},
		};

		beforeEach(() => {
			global.fetch = jest.fn();
		});

		afterEach(() => {
			jest.restoreAllMocks();
		});

		it("유효한 Naver access token을 검증하면 프로필을 반환한다", async () => {
			// Given
			(global.fetch as jest.Mock).mockResolvedValue({
				ok: true,
				json: () => Promise.resolve(mockNaverResponse),
			});

			// When
			const result = await service.verifyNaverToken("valid-naver-token");

			// Then
			expect(result).toEqual({
				id: "naver-user-123",
				email: "test@naver.com",
				emailVerified: true, // 이메일이 있으면 true
				name: "네이버유저",
				picture: "https://phinf.pstatic.net/profile.jpg",
			});
			expect(global.fetch).toHaveBeenCalledWith(
				"https://openapi.naver.com/v1/nid/me",
				expect.objectContaining({
					headers: {
						Authorization: "Bearer valid-naver-token",
					},
				}),
			);
		});

		it("이름이 없으면 닉네임을 사용한다", async () => {
			// Given
			(global.fetch as jest.Mock).mockResolvedValue({
				ok: true,
				json: () =>
					Promise.resolve({
						resultcode: "00",
						message: "success",
						response: {
							id: "naver-user-456",
							nickname: "닉네임만",
						},
					}),
			});

			// When
			const result = await service.verifyNaverToken("valid-token");

			// Then
			expect(result.name).toBe("닉네임만");
		});

		it("이메일이 없으면 emailVerified는 false이다", async () => {
			// Given
			(global.fetch as jest.Mock).mockResolvedValue({
				ok: true,
				json: () =>
					Promise.resolve({
						resultcode: "00",
						message: "success",
						response: {
							id: "naver-user-789",
							name: "이름만",
						},
					}),
			});

			// When
			const result = await service.verifyNaverToken("valid-token");

			// Then
			expect(result.email).toBeNull();
			expect(result.emailVerified).toBe(false);
		});

		it("401 응답은 socialTokenExpired 에러를 발생시킨다", async () => {
			// Given
			(global.fetch as jest.Mock).mockResolvedValue({
				ok: false,
				status: 401,
			});

			// When & Then
			await expect(service.verifyNaverToken("expired-token")).rejects.toThrow(
				BusinessException,
			);
		});

		it("resultcode가 00이 아니면 에러를 발생시킨다", async () => {
			// Given
			(global.fetch as jest.Mock).mockResolvedValue({
				ok: true,
				json: () =>
					Promise.resolve({
						resultcode: "01",
						message: "error",
					}),
			});

			// When & Then
			await expect(service.verifyNaverToken("invalid-token")).rejects.toThrow(
				BusinessException,
			);
		});

		it("response가 없으면 에러를 발생시킨다", async () => {
			// Given
			(global.fetch as jest.Mock).mockResolvedValue({
				ok: true,
				json: () =>
					Promise.resolve({
						resultcode: "00",
						message: "success",
					}),
			});

			// When & Then
			await expect(service.verifyNaverToken("invalid-token")).rejects.toThrow(
				BusinessException,
			);
		});
	});

	// ============================================
	// verifyAppleToken
	// ============================================
	// Apple 토큰 검증은 jose ESM 모듈을 사용하므로
	// 단위 테스트가 어렵습니다. E2E 또는 통합 테스트에서 검증합니다.
	// Jest의 ESM 지원이 제한적이므로 이 테스트는 스킵합니다.
	describe("verifyAppleToken", () => {
		it.skip("Apple 토큰 검증은 통합 테스트에서 수행합니다", () => {
			// jose는 ESM-only 모듈이므로 Jest에서 동적 import 모킹이 어렵습니다.
			// 실제 Apple 토큰 검증은 E2E 테스트 또는 실제 환경에서 검증합니다.
		});
	});
});
