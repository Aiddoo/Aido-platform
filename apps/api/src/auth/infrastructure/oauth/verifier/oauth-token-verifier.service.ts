import { ErrorCode } from "@aido/errors";
import { Injectable, Logger, OnModuleInit } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { OAuth2Client } from "google-auth-library";

import type { VerifiedProfile } from "@/auth/application/ports/oauth-identity-provider.port";
import { ApplicationException } from "@/shared/domain/exceptions/application.exception";
import { readJson } from "@/shared/infrastructure/http/read-json";
import {
	type JoseWrapper,
	type JWKSFunction,
	loadJose,
} from "@/shared/infrastructure/jose/jose-wrapper";

export type { VerifiedProfile };

interface AppleIdTokenClaims {
	iss: string;
	aud: string;
	exp: number;
	iat: number;
	sub: string;
	email?: string;
	email_verified?: string | boolean;
	is_private_email?: string | boolean;
	auth_time: number;
	nonce_supported: boolean;
	nonce?: string;
}

// 모바일 클라이언트 토큰을 서버에서 직접 검증 (각 OAuth Provider의 공식 API/JWKS 사용)
@Injectable()
export class OAuthTokenVerifierService implements OnModuleInit {
	readonly #logger = new Logger(OAuthTokenVerifierService.name);
	readonly #googleClient: OAuth2Client;
	#jose: JoseWrapper | null = null;
	#appleJWKS: JWKSFunction | null = null;

	// Apple JWKS URL
	private static readonly APPLE_JWKS_URL = "https://appleid.apple.com/auth/keys";
	private static readonly APPLE_ISSUER = "https://appleid.apple.com";

	// Kakao API URL
	private static readonly KAKAO_USER_INFO_URL =
		"https://kapi.kakao.com/v2/user/me?secure_resource=true";

	// Naver API URL
	private static readonly NAVER_USER_INFO_URL = "https://openapi.naver.com/v1/nid/me";

	constructor(private readonly configService: ConfigService) {
		// Google OAuth2 클라이언트 초기화
		this.#googleClient = new OAuth2Client(this.configService.get("GOOGLE_CLIENT_ID"));
	}

	async onModuleInit(): Promise<void> {
		this.#jose = await loadJose();
		this.#logger.log("Jose library loaded successfully");
	}

	async #getJose(): Promise<JoseWrapper> {
		if (!this.#jose) {
			this.#jose = await loadJose();
		}
		return this.#jose;
	}

	/**
	 * Provider별 토큰 검증 통합 dispatch 메서드
	 *
	 * Apple/Google은 idToken, Kakao/Naver는 accessToken을 사용합니다.
	 */
	async verifyToken(
		provider: "APPLE" | "GOOGLE" | "KAKAO" | "NAVER",
		token: string,
		nonce?: string,
	): Promise<VerifiedProfile> {
		switch (provider) {
			case "APPLE":
				return this.verifyAppleToken(token, nonce);
			case "GOOGLE":
				return this.verifyGoogleToken(token);
			case "KAKAO":
				return this.verifyKakaoToken(token);
			case "NAVER":
				return this.verifyNaverToken(token);
		}
	}

	// @see https://developer.apple.com/documentation/sign_in_with_apple/sign_in_with_apple_rest_api/verifying_a_user
	async verifyAppleToken(idToken: string, expectedNonce?: string): Promise<VerifiedProfile> {
		const jose = await this.#getJose();

		try {
			// JWKS 캐시 초기화 (필요시)
			if (!this.#appleJWKS) {
				const jwksUrl =
					this.configService.get<string>("APPLE_JWKS_URL") ??
					OAuthTokenVerifierService.APPLE_JWKS_URL;
				const cooldownDuration = this.configService.get<number>("APPLE_JWKS_COOLDOWN_DURATION_MS");
				this.#appleJWKS = jose.createRemoteJWKSet(
					new URL(jwksUrl),
					cooldownDuration === undefined ? undefined : { cooldownDuration },
				);
			}

			const appleClientId = this.configService.get<string>("APPLE_CLIENT_ID");

			// ID Token 검증
			const { payload } = await jose.jwtVerify<AppleIdTokenClaims>(idToken, this.#appleJWKS, {
				issuer: OAuthTokenVerifierService.APPLE_ISSUER,
				audience: appleClientId,
			});

			// nonce 검증 (제공된 경우)
			if (expectedNonce) {
				const { createHash } = await import("node:crypto");
				const hashedNonce = createHash("sha256").update(expectedNonce).digest("hex");
				if (payload.nonce !== hashedNonce) {
					this.#logger.warn("Apple nonce mismatch");
					throw new ApplicationException(ErrorCode.SOCIAL_0202, {
						provider: "APPLE",
					});
				}
			}

			// 이메일 인증 여부 확인
			const emailVerified =
				payload.email_verified === true || payload.email_verified === "true" || false;

			this.#logger.debug(`Apple token verified for user: ${payload.sub}`);

			return {
				id: payload.sub,
				email: payload.email ?? null,
				emailVerified,
			};
		} catch (error) {
			this.#logger.error(`Apple token verification failed: ${error}`);

			if (jose.isJWTExpiredError(error)) {
				throw new ApplicationException(ErrorCode.SOCIAL_0203, {
					provider: "APPLE",
				});
			}
			if (jose.isJWTClaimValidationError(error)) {
				throw new ApplicationException(ErrorCode.SOCIAL_0202, {
					provider: "APPLE",
				});
			}

			throw new ApplicationException(ErrorCode.SOCIAL_0202, {
				provider: "APPLE",
			});
		}
	}

	// @see https://developers.google.com/identity/sign-in/web/backend-auth
	async verifyGoogleToken(idToken: string): Promise<VerifiedProfile> {
		try {
			const googleClientId = this.configService.get<string>("GOOGLE_CLIENT_ID");

			// Google ID Token 검증
			const ticket = await this.#googleClient.verifyIdToken({
				idToken,
				audience: googleClientId,
			});

			const payload = ticket.getPayload();

			if (!payload) {
				throw new ApplicationException(ErrorCode.SOCIAL_0202, {
					provider: "GOOGLE",
				});
			}

			this.#logger.debug(`Google token verified for user: ${payload.sub}`);

			return {
				id: payload.sub ?? "",
				email: payload.email ?? null,
				emailVerified: payload.email_verified ?? false,
				name: payload.name,
				picture: payload.picture,
			};
		} catch (error) {
			const errorMessage = error instanceof Error ? error.message.toLowerCase() : "";
			const isExpired =
				errorMessage.includes("expired") || errorMessage.includes("token used too late");
			const errorType = error instanceof Error ? error.name : "UnknownError";

			// Google v11 오류 문자열에는 decoded payload가 포함될 수 있어 원문을 로그하지 않는다.
			this.#logger.error(
				`Google token verification failed (${isExpired ? "expired" : "invalid"}): ${errorType}`,
			);

			// Google Auth Library는 전용 만료 오류 타입 없이 일반 Error를 사용한다.
			// 실제 서명 검증 경로의 메시지는 "Token used too late"이므로 기존 expired 표현과 함께 처리한다.
			if (isExpired) {
				throw new ApplicationException(ErrorCode.SOCIAL_0203, {
					provider: "GOOGLE",
				});
			}

			throw new ApplicationException(ErrorCode.SOCIAL_0202, {
				provider: "GOOGLE",
			});
		}
	}

	// @see https://developers.kakao.com/docs/latest/ko/kakaologin/rest-api#req-user-info
	async verifyKakaoToken(accessToken: string): Promise<VerifiedProfile> {
		try {
			const response = await fetch(OAuthTokenVerifierService.KAKAO_USER_INFO_URL, {
				headers: {
					Authorization: `Bearer ${accessToken}`,
					"Content-Type": "application/x-www-form-urlencoded;charset=utf-8",
				},
			});

			if (!response.ok) {
				if (response.status === 401) {
					throw new ApplicationException(ErrorCode.SOCIAL_0203, {
						provider: "KAKAO",
					});
				}
				throw new ApplicationException(ErrorCode.SOCIAL_0202, {
					provider: "KAKAO",
				});
			}

			const data = await readJson<{
				id: number;
				kakao_account?: {
					email?: string;
					is_email_valid?: boolean;
					is_email_verified?: boolean;
					profile?: {
						nickname?: string;
						profile_image_url?: string;
					};
				};
			}>(response);

			const kakaoAccount = data.kakao_account;

			this.#logger.debug(`Kakao token verified for user: ${data.id}`);

			return {
				id: String(data.id),
				email: kakaoAccount?.email ?? null,
				emailVerified: kakaoAccount?.is_email_verified ?? false,
				name: kakaoAccount?.profile?.nickname,
				picture: kakaoAccount?.profile?.profile_image_url,
			};
		} catch (error) {
			this.#logger.error(`Kakao token verification failed: ${error}`);

			// ApplicationException은 그대로 전파
			if (error instanceof Error && error.name === "ApplicationException") {
				throw error;
			}

			throw new ApplicationException(ErrorCode.SOCIAL_0202, {
				provider: "KAKAO",
			});
		}
	}

	// @see https://developers.naver.com/docs/login/profile/profile.md
	async verifyNaverToken(accessToken: string): Promise<VerifiedProfile> {
		try {
			const response = await fetch(OAuthTokenVerifierService.NAVER_USER_INFO_URL, {
				headers: {
					Authorization: `Bearer ${accessToken}`,
				},
			});

			if (!response.ok) {
				if (response.status === 401) {
					throw new ApplicationException(ErrorCode.SOCIAL_0203, {
						provider: "NAVER",
					});
				}
				throw new ApplicationException(ErrorCode.SOCIAL_0202, {
					provider: "NAVER",
				});
			}

			const data = await readJson<{
				resultcode: string;
				message: string;
				response?: {
					id: string;
					email?: string;
					name?: string;
					nickname?: string;
					profile_image?: string;
				};
			}>(response);

			if (data.resultcode !== "00" || !data.response) {
				throw new ApplicationException(ErrorCode.SOCIAL_0202, {
					provider: "NAVER",
				});
			}

			const naverUser = data.response;

			this.#logger.debug(`Naver token verified for user: ${naverUser.id}`);

			// Naver는 이메일 인증 여부를 제공하지 않으므로 false 설정
			// 자동 계정 연동 불가 — 수동 연동 필요 (handleEmailConflict에서 처리)
			return {
				id: naverUser.id,
				email: naverUser.email ?? null,
				emailVerified: false,
				name: naverUser.name || naverUser.nickname,
				picture: naverUser.profile_image,
			};
		} catch (error) {
			this.#logger.error(`Naver token verification failed: ${error}`);

			// ApplicationException은 그대로 전파
			if (error instanceof Error && error.name === "ApplicationException") {
				throw error;
			}

			throw new ApplicationException(ErrorCode.SOCIAL_0202, {
				provider: "NAVER",
			});
		}
	}
}
