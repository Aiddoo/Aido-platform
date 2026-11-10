import type { ConfigType } from "@nestjs/config";

import { defineConfig } from "#api/platform/config/define-config";
import { emailSchema } from "#api/platform/config/schemas/email.schema";

/** 발송 어댑터·발신자. 빈 API 키는 없는 키로 본다(어댑터가 보내기 전에 not_configured로 끝낸다). */
export const notificationEmailConfig = defineConfig(
  "notificationEmail",
  emailSchema
    .pick({ EMAIL_PROVIDER: true, RESEND_API_KEY: true, EMAIL_FROM: true, EMAIL_FROM_NAME: true })
    .transform((env) => ({
      provider: env.EMAIL_PROVIDER,
      apiKey:
        env.RESEND_API_KEY == null || env.RESEND_API_KEY.length === 0 ? null : env.RESEND_API_KEY,
      from: env.EMAIL_FROM,
      fromName: env.EMAIL_FROM_NAME,
    })),
  (env) => ({
    EMAIL_PROVIDER: env.EMAIL_PROVIDER,
    RESEND_API_KEY: env.RESEND_API_KEY,
    EMAIL_FROM: env.EMAIL_FROM,
    EMAIL_FROM_NAME: env.EMAIL_FROM_NAME,
  }),
);

export type NotificationEmailConfig = ConfigType<typeof notificationEmailConfig>;
