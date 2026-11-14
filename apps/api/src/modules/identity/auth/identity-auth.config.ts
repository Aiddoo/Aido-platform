import { defineConfig } from "#api/platform/config/define-config";
import { oauthSchema } from "#api/platform/config/schemas/oauth.schema";

export interface OAuthClientConfig {
  readonly clientId: string | undefined;
  readonly clientSecret: string | undefined;
  readonly callbackUrl: string | undefined;
  readonly isConfigured: boolean;
}

export interface AppleIdTokenConfig {
  readonly clientId: string | undefined;
  readonly jwksUrl: string | undefined;
  readonly jwksCooldownDurationMs: number | undefined;
}

function toClientConfig(
  clientId: string | undefined,
  clientSecret: string | undefined,
  callbackUrl: string | undefined,
): OAuthClientConfig {
  return {
    clientId,
    clientSecret,
    callbackUrl,
    isConfigured: Boolean(clientId && clientSecret),
  };
}

export const identityAuthConfig = defineConfig(
  "identityAuth",
  oauthSchema.transform((env) => ({
    google: toClientConfig(env.GOOGLE_CLIENT_ID, env.GOOGLE_CLIENT_SECRET, env.GOOGLE_CALLBACK_URL),
    kakao: toClientConfig(env.KAKAO_CLIENT_ID, env.KAKAO_CLIENT_SECRET, env.KAKAO_CALLBACK_URL),
    naver: toClientConfig(env.NAVER_CLIENT_ID, env.NAVER_CLIENT_SECRET, env.NAVER_CALLBACK_URL),
    apple: {
      clientId: env.APPLE_CLIENT_ID,
      jwksUrl: env.APPLE_JWKS_URL,
      jwksCooldownDurationMs: env.APPLE_JWKS_COOLDOWN_DURATION_MS,
    } satisfies AppleIdTokenConfig,
  })),
  (env) => ({
    GOOGLE_CLIENT_ID: env.GOOGLE_CLIENT_ID,
    GOOGLE_CLIENT_SECRET: env.GOOGLE_CLIENT_SECRET,
    GOOGLE_CALLBACK_URL: env.GOOGLE_CALLBACK_URL,
    APPLE_CLIENT_ID: env.APPLE_CLIENT_ID,
    APPLE_JWKS_URL: env.APPLE_JWKS_URL,
    APPLE_JWKS_COOLDOWN_DURATION_MS: env.APPLE_JWKS_COOLDOWN_DURATION_MS,
    APPLE_TEAM_ID: env.APPLE_TEAM_ID,
    APPLE_KEY_ID: env.APPLE_KEY_ID,
    APPLE_PRIVATE_KEY: env.APPLE_PRIVATE_KEY,
    KAKAO_CLIENT_ID: env.KAKAO_CLIENT_ID,
    KAKAO_CLIENT_SECRET: env.KAKAO_CLIENT_SECRET,
    KAKAO_CALLBACK_URL: env.KAKAO_CALLBACK_URL,
    NAVER_CLIENT_ID: env.NAVER_CLIENT_ID,
    NAVER_CLIENT_SECRET: env.NAVER_CLIENT_SECRET,
    NAVER_CALLBACK_URL: env.NAVER_CALLBACK_URL,
  }),
);
