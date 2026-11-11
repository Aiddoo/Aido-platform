import type { ConfigType } from "@nestjs/config";

import { defineConfig } from "#api/platform/config/define-config";
import { jwtSchema } from "#api/platform/config/schemas/jwt.schema";
import { tokenSigningSchema } from "#api/platform/config/schemas/security.schema";

/** 댓글 cursor 서명 키. 비우면 출시 앱이 가진 cursor를 그대로 열 수 있게 JWT_SECRET으로 서명한다. */
export const engagementCommentsConfig = defineConfig(
  "engagementComments",
  tokenSigningSchema
    .pick({ CURSOR_SIGNING_KEYS: true })
    .extend(jwtSchema.pick({ JWT_SECRET: true }).shape)
    .transform((env) => ({
      cursorSigning: { configured: env.CURSOR_SIGNING_KEYS, legacySecret: env.JWT_SECRET },
    })),
  (env) => ({ CURSOR_SIGNING_KEYS: env.CURSOR_SIGNING_KEYS, JWT_SECRET: env.JWT_SECRET }),
);

export type EngagementCommentsConfig = ConfigType<typeof engagementCommentsConfig>;
