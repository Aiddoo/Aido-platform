import { defineConfig } from "#api/platform/config/define-config";
import { jwtSchema } from "#api/platform/config/schemas/jwt.schema";
import { pushSchema } from "#api/platform/config/schemas/push.schema";
import { tokenSigningSchema } from "#api/platform/config/schemas/security.schema";

/**
 * Expo 접근 토큰·발송 한도 저장소·광고 수신 거부 토큰 서명 키.
 * 서명 키를 비우면 출시 앱이 가진 링크를 그대로 열 수 있게 JWT_SECRET으로 서명한다.
 */
export const notificationPushConfig = defineConfig(
  "notificationPush",
  pushSchema
    .extend(tokenSigningSchema.pick({ OPT_OUT_TOKEN_SIGNING_KEYS: true }).shape)
    .extend(jwtSchema.pick({ JWT_SECRET: true }).shape)
    .transform((env) => ({
      expoAccessToken: env.EXPO_ACCESS_TOKEN,
      rateLimitBackend: env.PUSH_RATE_LIMIT_BACKEND,
      optOutTokenSigning: {
        configured: env.OPT_OUT_TOKEN_SIGNING_KEYS,
        legacySecret: env.JWT_SECRET,
      },
    })),
  (env) => ({
    EXPO_ACCESS_TOKEN: env.EXPO_ACCESS_TOKEN,
    PUSH_RATE_LIMIT_BACKEND: env.PUSH_RATE_LIMIT_BACKEND,
    OPT_OUT_TOKEN_SIGNING_KEYS: env.OPT_OUT_TOKEN_SIGNING_KEYS,
    JWT_SECRET: env.JWT_SECRET,
  }),
);
