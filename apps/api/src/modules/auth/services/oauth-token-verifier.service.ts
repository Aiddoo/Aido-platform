import { Injectable, Logger, OnModuleInit } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { OAuth2Client } from "google-auth-library";

import { BusinessExceptions } from "@/common/exception/services/business-exception.service";

/**
 * jose 라이브러리 래퍼 타입 (ESM 동적 import용)
 *
 * jose는 ESM-only 모듈이므로 동적 import를 사용합니다.
 * 타입 안전성을 위해 필요한 함수들을 래핑합니다.
 */
interface JoseWrapper {
	createRemoteJWKSet: (url: URL) => JWKSFunction;
	jwtVerify: <T>(
		jwt: string,
		jwks: JWKSFunction,
		options?: { issuer?: string; audience?: string },
	) => Promise<{ payload: T }>;
	isJWTExpiredError: (error: unknown) => boolean;
	isJWTClaimValidationError: (error: unknown) => boolean;
}

// JWKS 함수 타입 (createRemoteJWKSet 반환값)
type JWKSFunction = (
	protectedHeader: unknown,
	token: unknown,
) => Promise<unknown>;

export interface VerifiedProfile {
	id: string;
	email?: string | null;
	emailVerified: boolean;
	name?: string;
	picture?: string;
}

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
}

// 모바일 클라이언트 토큰을 서버에서 직접 검증 (각 OAuth Provider의 공식 API/JWKS 사용)
@Injectable()
export class OAuthTokenVerifierService implements OnModuleInit {
	private readonly _logger = new Logger(OAuthTokenVerifierService.name);
	private readonly _googleClient: OAuth2Client;
	private _jose: JoseWrapper | null = null;
	private _appleJWKS: JWKSFunction | null = null;

	// Apple JWKS URL
	private static readonly APPLE_JWKS_URL =
		"https://appleid.apple.com/auth/keys";
	private static readonly APPLE_ISSUER = "https://appleid.apple.com";

	// Kakao API URL
	private static readonly KAKAO_USER_INFO_URL =
		"https://kapi.kakao.com/v2/user/me";

	// Naver API URL
	private static readonly NAVER_USER_INFO_URL =
		"https://openapi.naver.com/v1/nid/me";

	constructor(private readonly _config: ConfigService) {
		// Google OAuth2 클라이언트 초기화
		this._googleClient = new OAuth2Client(this._config.get("GOOGLE_CLIENT_ID"));
	}

	async onModuleInit(): Promise<void> {
		this._jose = await this._loadJose();
		this._logger.log("Jose library loaded successfully");
	}

	private async _loadJose(): Promise<JoseWrapper> {
		const jose = await import("jose");
		return {
			createRemoteJWKSet: (url: URL) =>
				jose.createRemoteJWKSet(url) as JWKSFunction,
			jwtVerify: <T>(
				jwt: string,
				jwks: JWKSFunction,
				options?: { issuer?: string; audience?: string },
			) =>
				jose.jwtVerify(
					jwt,
					jwks as Parameters<typeof jose.jwtVerify>[1],
					options,
				) as Promise<{
					payload: T;
				}>,
			isJWTExpiredError: (error: unknown): boolean =>
				error instanceof jose.errors.JWTExpired,
			isJWTClaimValidationError: (error: unknown): boolean =>
				error instanceof jose.errors.JWTClaimValidationFailed,
		};
	}

	private async _getJose(): Promise<JoseWrapper> {
		if (!this._jose) {
			this._jose = await this._loadJose();
		}
		return this._jose;
	}

	// @see https://developer.apple.com/documentation/sign_in_with_apple/sign_in_with_apple_rest_api/verifying_a_user
	async verifyAppleToken(idToken: string): Promise<VerifiedProfile> {
		const jose = await this._getJose();

		try {
			// JWKS 캐시 초기화 (필요시)
			if (!this._appleJWKS) {
				this._appleJWKS = jose.createRemoteJWKSet(
					new URL(OAuthTokenVerifierService.APPLE_JWKS_URL),
				);
			}

			const appleClientId = this._config.get<string>("APPLE_CLIENT_ID");

			// ID Token 검증
			const { payload } = await jose.jwtVerify<AppleIdTokenClaims>(
				idToken,
				this._appleJWKS,
				{
					issuer: OAuthTokenVerifierService.APPLE_ISSUER,
					audience: appleClientId,
				},
			);

			// 이메일 인증 여부 확인
			const emailVerified =
				payload.email_verified === true ||
				payload.email_verified === "true" ||
				false;

			this._logger.debug(`Apple token verified for user: ${payload.sub}`);

			return {
				id: payload.sub,
				email: payload.email ?? null,
				emailVerified,
			};
		} catch (error) {
			this._logger.error(`Apple token verification failed: ${error}`);

			if (jose.isJWTExpiredError(error)) {
				throw BusinessExceptions.socialTokenExpired("APPLE");
			}
			if (jose.isJWTClaimValidationError(error)) {
				throw BusinessExceptions.socialTokenInvalid("APPLE");
			}

			throw BusinessExceptions.socialTokenInvalid("APPLE");
		}
	}

	// @see https://developers.google.com/identity/sign-in/web/backend-auth
	async verifyGoogleToken(idToken: string): Promise<VerifiedProfile> {
		try {
			const googleClientId = this._config.get<string>("GOOGLE_CLIENT_ID");

			// Google ID Token 검증
			const ticket = await this._googleClient.verifyIdToken({
				idToken,
				audience: googleClientId,
			});

			const payload = ticket.getPayload();

			if (!payload) {
				throw BusinessExceptions.socialTokenInvalid("GOOGLE");
			}

			this._logger.debug(`Google token verified for user: ${payload.sub}`);

			return {
				id: payload.sub ?? "",
				email: payload.email ?? null,
				emailVerified: payload.email_verified ?? false,
				name: payload.name,
				picture: payload.picture,
			};
		} catch (error) {
			this._logger.error(`Google token verification failed: ${error}`);

			// Google Auth Library는 만료된 토큰에 대해 일반 에러를 던짐
			if (error instanceof Error && error.message.includes("expired")) {
				throw BusinessExceptions.socialTokenExpired("GOOGLE");
			}

			throw BusinessExceptions.socialTokenInvalid("GOOGLE");
		}
	}

	// @see https://developers.kakao.com/docs/latest/ko/kakaologin/rest-api#req-user-info
	async verifyKakaoToken(accessToken: string): Promise<VerifiedProfile> {
		try {
			const response = await fetch(
				OAuthTokenVerifierService.KAKAO_USER_INFO_URL,
				{
					headers: {
						Authorization: `Bearer ${accessToken}`,
						"Content-Type": "application/x-www-form-urlencoded;charset=utf-8",
					},
				},
			);

			if (!response.ok) {
				if (response.status === 401) {
					throw BusinessExceptions.socialTokenExpired("KAKAO");
				}
				throw BusinessExceptions.socialTokenInvalid("KAKAO");
			}

			const data = (await response.json()) as {
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
			};

			const kakaoAccount = data.kakao_account;

			this._logger.debug(`Kakao token verified for user: ${data.id}`);

			return {
				id: String(data.id),
				email: kakaoAccount?.email ?? null,
				emailVerified: kakaoAccount?.is_email_verified ?? false,
				name: kakaoAccount?.profile?.nickname,
				picture: kakaoAccount?.profile?.profile_image_url,
			};
		} catch (error) {
			this._logger.error(`Kakao token verification failed: ${error}`);

			// BusinessException은 그대로 전파
			if (error instanceof Error && error.name === "BusinessException") {
				throw error;
			}

			throw BusinessExceptions.socialTokenInvalid("KAKAO");
		}
	}

	// @see https://developers.naver.com/docs/login/profile/profile.md
	async verifyNaverToken(accessToken: string): Promise<VerifiedProfile> {
		try {
			const response = await fetch(
				OAuthTokenVerifierService.NAVER_USER_INFO_URL,
				{
					headers: {
						Authorization: `Bearer ${accessToken}`,
					},
				},
			);

			if (!response.ok) {
				if (response.status === 401) {
					throw BusinessExceptions.socialTokenExpired("NAVER");
				}
				throw BusinessExceptions.socialTokenInvalid("NAVER");
			}

			const data = (await response.json()) as {
				resultcode: string;
				message: string;
				response?: {
					id: string;
					email?: string;
					name?: string;
					nickname?: string;
					profile_image?: string;
				};
			};

			if (data.resultcode !== "00" || !data.response) {
				throw BusinessExceptions.socialTokenInvalid("NAVER");
			}

			const naverUser = data.response;

			this._logger.debug(`Naver token verified for user: ${naverUser.id}`);

			// Naver는 이메일 인증 여부를 별도로 제공하지 않음
			// 이메일이 있으면 인증된 것으로 간주
			return {
				id: naverUser.id,
				email: naverUser.email ?? null,
				emailVerified: !!naverUser.email,
				name: naverUser.name || naverUser.nickname,
				picture: naverUser.profile_image,
			};
		} catch (error) {
			this._logger.error(`Naver token verification failed: ${error}`);

			// BusinessException은 그대로 전파
			if (error instanceof Error && error.name === "BusinessException") {
				throw error;
			}

			throw BusinessExceptions.socialTokenInvalid("NAVER");
		}
	}
}
