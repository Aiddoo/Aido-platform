/**
 * OAuthTokenVerifierService 단위 테스트
 *
 * @description
 * Google, Kakao, Naver, Apple OAuth 토큰 검증 로직을 검증한다.
 * 유효/만료/잘못된 토큰 처리, 프로필 파싱을 확인한다.
 *
 * 실행 명령:
 * ```bash
 * pnpm --filter @aido/api test oauth-token-verifier.service.spec.ts
 * ```
 */

import { createHash } from "node:crypto";
import { createServer, type Server } from "node:http";

import { ErrorCode } from "@aido/errors";
import { ConfigService } from "@nestjs/config";
import type { Mocked } from "@suites/doubles.jest";
import { TestBed } from "@suites/unit";
import { asMock } from "@test/mocks";
import { exportJWK, generateKeyPair, type JWK, SignJWT } from "jose";

import { OAuthTokenVerifierService } from "@/auth/infrastructure/oauth/verifier/oauth-token-verifier.service";
import { ApplicationException } from "@/shared/domain/exceptions/application.exception";

// Google Auth Library 모킹
jest.mock("google-auth-library", () => ({
	OAuth2Client: jest.fn().mockImplementation(() => ({
		verifyIdToken: jest.fn(),
	})),
}));

describe("OAuthTokenVerifierService — OAuth 토큰 검증 서비스", () => {
	let service: OAuthTokenVerifierService;
	let mockGoogleVerifyIdToken: jest.Mock;
	let configService: Mocked<ConfigService>;
	let appleJwksUrl: string | undefined;

	beforeEach(async () => {
		// Google Auth Library mock 설정
		const { OAuth2Client } = jest.requireMock("google-auth-library");
		mockGoogleVerifyIdToken = jest.fn();
		OAuth2Client.mockImplementation(() => ({
			verifyIdToken: mockGoogleVerifyIdToken,
		}));

		const { unit, unitRef } = await TestBed.solitary(OAuthTokenVerifierService).compile();

		service = unit;
		configService = unitRef.get(ConfigService);

		// ConfigService mock 설정
		configService.get.mockImplementation((key: string) => {
			const config: Record<string, string | number> = {
				GOOGLE_CLIENT_ID: "google-client-id",
				APPLE_CLIENT_ID: "apple-client-id",
				...(appleJwksUrl
					? {
							APPLE_JWKS_URL: appleJwksUrl,
							APPLE_JWKS_COOLDOWN_DURATION_MS: 0,
						}
					: {}),
			};
			return config[key];
		});
	});

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
				ApplicationException,
			);
		});

		it("만료된 토큰은 socialTokenExpired 에러를 발생시킨다", async () => {
			// Given
			mockGoogleVerifyIdToken.mockRejectedValue(new Error("Token used too late, expired"));

			// When & Then
			await expect(service.verifyGoogleToken("expired-token")).rejects.toThrow(
				ApplicationException,
			);
		});

		it("잘못된 토큰은 socialTokenInvalid 에러를 발생시킨다", async () => {
			// Given
			mockGoogleVerifyIdToken.mockRejectedValue(new Error("Invalid signature"));

			// When & Then
			await expect(service.verifyGoogleToken("malformed-token")).rejects.toThrow(
				ApplicationException,
			);
		});
	});

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

		it("유효한 Kakao access token을 검증하면 프로필을 반환한다", async () => {
			// Given
			asMock(global.fetch).mockResolvedValue({
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
				"https://kapi.kakao.com/v2/user/me?secure_resource=true",
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
			asMock(global.fetch).mockResolvedValue({
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
			asMock(global.fetch).mockResolvedValue({
				ok: false,
				status: 401,
			});

			// When & Then
			await expect(service.verifyKakaoToken("expired-token")).rejects.toThrow(ApplicationException);
		});

		it("기타 에러 응답은 socialTokenInvalid 에러를 발생시킨다", async () => {
			// Given
			asMock(global.fetch).mockResolvedValue({
				ok: false,
				status: 400,
			});

			// When & Then
			await expect(service.verifyKakaoToken("invalid-token")).rejects.toThrow(ApplicationException);
		});
	});

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

		it("유효한 Naver access token을 검증하면 프로필을 반환한다", async () => {
			// Given
			asMock(global.fetch).mockResolvedValue({
				ok: true,
				json: () => Promise.resolve(mockNaverResponse),
			});

			// When
			const result = await service.verifyNaverToken("valid-naver-token");

			// Then
			expect(result).toEqual({
				id: "naver-user-123",
				email: "test@naver.com",
				emailVerified: false, // Naver는 이메일 인증 여부를 제공하지 않으므로 항상 false
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
			asMock(global.fetch).mockResolvedValue({
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
			asMock(global.fetch).mockResolvedValue({
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
			asMock(global.fetch).mockResolvedValue({
				ok: false,
				status: 401,
			});

			// When & Then
			await expect(service.verifyNaverToken("expired-token")).rejects.toThrow(ApplicationException);
		});

		it("resultcode가 00이 아니면 에러를 발생시킨다", async () => {
			// Given
			asMock(global.fetch).mockResolvedValue({
				ok: true,
				json: () =>
					Promise.resolve({
						resultcode: "01",
						message: "error",
					}),
			});

			// When & Then
			await expect(service.verifyNaverToken("invalid-token")).rejects.toThrow(ApplicationException);
		});

		it("response가 없으면 에러를 발생시킨다", async () => {
			// Given
			asMock(global.fetch).mockResolvedValue({
				ok: true,
				json: () =>
					Promise.resolve({
						resultcode: "00",
						message: "success",
					}),
			});

			// When & Then
			await expect(service.verifyNaverToken("invalid-token")).rejects.toThrow(ApplicationException);
		});
	});

	describe("verifyAppleToken", () => {
		const nativeFetch = global.fetch;
		const keyIds = {
			first: "apple-key-1",
			second: "apple-key-2",
		} as const;
		let keyPairs: {
			first: Awaited<ReturnType<typeof generateKeyPair>>;
			second: Awaited<ReturnType<typeof generateKeyPair>>;
		};
		let publicJwks: { first: JWK; second: JWK };
		let activeJwks: JWK[];
		let jwksServer: Server;
		let requestCount: number;

		beforeAll(async () => {
			const [firstKeyPair, secondKeyPair] = await Promise.all([
				generateKeyPair("RS256", { extractable: true }),
				generateKeyPair("RS256", { extractable: true }),
			]);
			keyPairs = { first: firstKeyPair, second: secondKeyPair };
			const [firstPublicJwk, secondPublicJwk] = await Promise.all([
				exportJWK(firstKeyPair.publicKey),
				exportJWK(secondKeyPair.publicKey),
			]);
			publicJwks = {
				first: {
					...firstPublicJwk,
					alg: "RS256",
					kid: keyIds.first,
					use: "sig",
				},
				second: {
					...secondPublicJwk,
					alg: "RS256",
					kid: keyIds.second,
					use: "sig",
				},
			};

			jwksServer = createServer((request, response) => {
				if (request.method !== "GET" || request.url !== "/auth/keys") {
					response.writeHead(404).end();
					return;
				}

				requestCount += 1;
				response
					.writeHead(200, { "content-type": "application/json" })
					.end(JSON.stringify({ keys: activeJwks }));
			});

			await new Promise<void>((resolve, reject) => {
				jwksServer.once("error", reject);
				jwksServer.listen(0, "127.0.0.1", resolve);
			});

			const address = jwksServer.address();
			if (!address || typeof address === "string") {
				throw new Error("Apple JWKS test server address is unavailable");
			}
			appleJwksUrl = `http://127.0.0.1:${address.port}/auth/keys`;
		});

		beforeEach(() => {
			global.fetch = nativeFetch;
			activeJwks = [publicJwks.first];
			requestCount = 0;
		});

		afterAll(async () => {
			global.fetch = nativeFetch;
			appleJwksUrl = undefined;
			await new Promise<void>((resolve, reject) => {
				jwksServer.close((error) => {
					if (error) {
						reject(error);
						return;
					}
					resolve();
				});
			});
		});

		async function signAppleToken(
			key: "first" | "second",
			keyId: string,
			claims: Record<string, unknown> = {},
		): Promise<string> {
			const now = Math.floor(Date.now() / 1000);
			const userNumber = key === "first" ? 1 : 2;

			return new SignJWT({
				auth_time: now,
				email: `apple-user-${userNumber}@example.com`,
				email_verified: "true",
				nonce_supported: true,
				...claims,
			})
				.setProtectedHeader({ alg: "RS256", kid: keyId })
				.setIssuer("https://appleid.apple.com")
				.setAudience("apple-client-id")
				.setSubject(`apple-user-${userNumber}`)
				.setIssuedAt(now)
				.setExpirationTime(now + 3_600)
				.sign(keyPairs[key].privateKey);
		}

		it("실제 Apple 서명과 nonce를 검증하고 프로필을 반환한다", async () => {
			// Given
			const nonce = "apple-raw-nonce";
			const idToken = await signAppleToken("first", keyIds.first, {
				nonce: createHash("sha256").update(nonce).digest("hex"),
			});

			// When
			const result = await service.verifyAppleToken(idToken, nonce);

			// Then
			expect(result).toEqual({
				id: "apple-user-1",
				email: "apple-user-1@example.com",
				emailVerified: true,
			});
			expect(requestCount).toBe(1);
		});

		it("서명은 유효하지만 nonce가 다르면 socialTokenInvalid를 던진다", async () => {
			// Given
			const idToken = await signAppleToken("first", keyIds.first, {
				nonce: createHash("sha256").update("token-raw-nonce").digest("hex"),
			});

			// When & Then
			await expect(service.verifyAppleToken(idToken, "request-raw-nonce")).rejects.toMatchObject({
				errorCode: ErrorCode.SOCIAL_0202,
				details: { provider: "APPLE" },
			});
			expect(requestCount).toBe(1);
		});

		it("캐시된 kid가 교체되면 JWKS를 다시 조회하고 새 키를 검증한다", async () => {
			// Given
			const firstToken = await signAppleToken("first", keyIds.first);
			await expect(service.verifyAppleToken(firstToken)).resolves.toMatchObject({
				id: "apple-user-1",
			});
			activeJwks = [publicJwks.second];
			const rotatedToken = await signAppleToken("second", keyIds.second);

			// When
			const result = await service.verifyAppleToken(rotatedToken);

			// Then
			expect(result).toMatchObject({ id: "apple-user-2" });
			expect(requestCount).toBe(2);
		});

		it("JWKS에 없는 kid의 토큰은 socialTokenInvalid를 던진다", async () => {
			// Given
			const idToken = await signAppleToken("second", "unknown-apple-kid");

			// When & Then
			await expect(service.verifyAppleToken(idToken)).rejects.toMatchObject({
				errorCode: ErrorCode.SOCIAL_0202,
				details: { provider: "APPLE" },
			});
			expect(requestCount).toBe(2);
		});
	});
});
