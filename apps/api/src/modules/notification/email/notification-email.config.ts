import type { ConfigType } from "@nestjs/config";

import { defineConfig } from "#api/platform/config/define-config";
import { appSchema, resolveAppEnvironment } from "#api/platform/config/schemas/app.schema";
import { defaultEmailProvider, emailSchema } from "#api/platform/config/schemas/email.schema";

/** 발송 어댑터·발신자. 빈 API 키는 없는 키로 본다(어댑터가 보내기 전에 not_configured로 끝낸다). */
export const notificationEmailConfig = defineConfig(
  "notificationEmail",
  appSchema
    .pick({ NODE_ENV: true, APP_ENV: true })
    .extend(
      emailSchema.pick({
        EMAIL_PROVIDER: true,
        RESEND_API_KEY: true,
        EMAIL_FROM: true,
        EMAIL_FROM_NAME: true,
      }).shape,
    )
    .transform((env) => {
      const apiKey =
        env.RESEND_API_KEY == null || env.RESEND_API_KEY.length === 0 ? null : env.RESEND_API_KEY;
      return {
        provider: env.EMAIL_PROVIDER ?? defaultEmailProvider(resolveAppEnvironment(env), apiKey),
        apiKey,
        from: env.EMAIL_FROM,
        fromName: env.EMAIL_FROM_NAME,
      };
    }),
  (env) => ({
    NODE_ENV: env.NODE_ENV,
    APP_ENV: env.APP_ENV,
    EMAIL_PROVIDER: env.EMAIL_PROVIDER,
    RESEND_API_KEY: env.RESEND_API_KEY,
    EMAIL_FROM: env.EMAIL_FROM,
    EMAIL_FROM_NAME: env.EMAIL_FROM_NAME,
  }),
);

export type NotificationEmailConfig = ConfigType<typeof notificationEmailConfig>;
