import { z } from "zod";

/**
 * Google OAuth 설정
 */
const googleOAuthSchema = z.object({
  GOOGLE_CLIENT_ID: z.string().optional(),
  GOOGLE_CLIENT_SECRET: z.string().optional(),
  GOOGLE_CALLBACK_URL: z.url().optional(),
});

/**
 * Apple OAuth 설정
 */
const appleOAuthSchema = z.object({
  APPLE_CLIENT_ID: z.string().optional(),
  APPLE_JWKS_URL: z.url().optional(),
  APPLE_JWKS_COOLDOWN_DURATION_MS: z.coerce.number().int().nonnegative().optional(),
  APPLE_TEAM_ID: z.string().optional(),
  APPLE_KEY_ID: z.string().optional(),
  APPLE_PRIVATE_KEY: z.string().optional(),
});

/**
 * Kakao OAuth 설정
 */
const kakaoOAuthSchema = z.object({
  KAKAO_CLIENT_ID: z.string().optional(),
  KAKAO_CLIENT_SECRET: z.string().optional(),
  KAKAO_CALLBACK_URL: z.url().optional(),
});

/**
 * Naver OAuth 설정
 */
const naverOAuthSchema = z.object({
  NAVER_CLIENT_ID: z.string().optional(),
  NAVER_CLIENT_SECRET: z.string().optional(),
  NAVER_CALLBACK_URL: z.url().optional(),
});

/**
 * 통합 OAuth 스키마 (dev에서는 선택적)
 */
export const oauthSchema = z.object({
  ...googleOAuthSchema.shape,
  ...appleOAuthSchema.shape,
  ...kakaoOAuthSchema.shape,
  ...naverOAuthSchema.shape,
});

export type OAuthConfig = z.infer<typeof oauthSchema>;

/** 로그인 공급자가 하나라도 갖춰졌는지. 운영은 하나 이상 필요하다(production-readiness.ts). */
export function hasOAuthProvider(config: OAuthConfig): boolean {
  const hasGoogle = !!(config.GOOGLE_CLIENT_ID && config.GOOGLE_CLIENT_SECRET);
  const hasKakao = !!(config.KAKAO_CLIENT_ID && config.KAKAO_CLIENT_SECRET);
  const hasNaver = !!(config.NAVER_CLIENT_ID && config.NAVER_CLIENT_SECRET);
  const hasApple = !!(
    config.APPLE_CLIENT_ID &&
    config.APPLE_TEAM_ID &&
    config.APPLE_KEY_ID &&
    config.APPLE_PRIVATE_KEY
  );

  return hasGoogle || hasKakao || hasNaver || hasApple;
}
