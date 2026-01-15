import { z } from "zod";

/**
 * Google OAuth 설정
 */
export const googleOAuthSchema = z.object({
	GOOGLE_CLIENT_ID: z.string().optional(),
	GOOGLE_CLIENT_SECRET: z.string().optional(),
	GOOGLE_CALLBACK_URL: z.string().url().optional(),
});

/**
 * Apple OAuth 설정
 */
export const appleOAuthSchema = z.object({
	APPLE_CLIENT_ID: z.string().optional(),
	APPLE_SERVICE_ID: z.string().optional(),
	APPLE_TEAM_ID: z.string().optional(),
	APPLE_KEY_ID: z.string().optional(),
	APPLE_PRIVATE_KEY: z.string().optional(),
	APPLE_CALLBACK_URL: z.string().url().optional(),
});

/**
 * Kakao OAuth 설정
 */
export const kakaoOAuthSchema = z.object({
	KAKAO_CLIENT_ID: z.string().optional(),
	KAKAO_CLIENT_SECRET: z.string().optional(),
	KAKAO_CALLBACK_URL: z.string().url().optional(),
});

/**
 * Naver OAuth 설정
 */
export const naverOAuthSchema = z.object({
	NAVER_CLIENT_ID: z.string().optional(),
	NAVER_CLIENT_SECRET: z.string().optional(),
	NAVER_CALLBACK_URL: z.string().url().optional(),
});

/**
 * 통합 OAuth 스키마 (dev에서는 선택적)
 */
export const oauthSchema = z
	.object({})
	.merge(googleOAuthSchema)
	.merge(appleOAuthSchema)
	.merge(kakaoOAuthSchema)
	.merge(naverOAuthSchema);

export type OAuthConfig = z.infer<typeof oauthSchema>;
export type GoogleOAuthConfig = z.infer<typeof googleOAuthSchema>;
export type AppleOAuthConfig = z.infer<typeof appleOAuthSchema>;
export type KakaoOAuthConfig = z.infer<typeof kakaoOAuthSchema>;
export type NaverOAuthConfig = z.infer<typeof naverOAuthSchema>;

/**
 * Production 환경에서 OAuth 필수 검증
 * Google, Kakao 중 최소 하나는 설정되어야 함
 */
export function validateOAuthForProduction(config: OAuthConfig): boolean {
	const hasGoogle = !!(config.GOOGLE_CLIENT_ID && config.GOOGLE_CLIENT_SECRET);
	const hasKakao = !!(config.KAKAO_CLIENT_ID && config.KAKAO_CLIENT_SECRET);
	const hasNaver = !!(config.NAVER_CLIENT_ID && config.NAVER_CLIENT_SECRET);
	const hasApple = !!(
		config.APPLE_CLIENT_ID &&
		config.APPLE_TEAM_ID &&
		config.APPLE_KEY_ID &&
		config.APPLE_PRIVATE_KEY
	);

	// Production에서는 최소 하나의 OAuth 프로바이더 필요
	return hasGoogle || hasKakao || hasNaver || hasApple;
}
