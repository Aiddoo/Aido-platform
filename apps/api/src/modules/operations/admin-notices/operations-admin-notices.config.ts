import type { ConfigType } from "@nestjs/config";

import { defineConfig } from "#api/platform/config/define-config";
import { appSchema, resolveAppEnvironment } from "#api/platform/config/schemas/app.schema";
import {
  defaultAdminNotifierProvider,
  webhookSchema,
} from "#api/platform/config/schemas/webhook.schema";

/** 관리자 알림 어댑터와 Discord 웹훅(가입·결제 채널). */
export const operationsAdminNoticesConfig = defineConfig(
  "operationsAdminNotices",
  appSchema
    .pick({ NODE_ENV: true, APP_ENV: true })
    .extend(webhookSchema.shape)
    .transform((env) => {
      const discordWebhookUrls = {
        admin: env.DISCORD_SIGNUP_WEBHOOK_URL,
        payment: env.DISCORD_PAYMENT_WEBHOOK_URL,
      };
      const hasWebhookUrl = Boolean(discordWebhookUrls.admin || discordWebhookUrls.payment);
      return {
        provider:
          env.ADMIN_NOTIFIER_PROVIDER ??
          defaultAdminNotifierProvider(resolveAppEnvironment(env), hasWebhookUrl),
        discordWebhookUrls,
      };
    }),
  (env) => ({
    NODE_ENV: env.NODE_ENV,
    APP_ENV: env.APP_ENV,
    ADMIN_NOTIFIER_PROVIDER: env.ADMIN_NOTIFIER_PROVIDER,
    DISCORD_SIGNUP_WEBHOOK_URL: env.DISCORD_SIGNUP_WEBHOOK_URL,
    DISCORD_PAYMENT_WEBHOOK_URL: env.DISCORD_PAYMENT_WEBHOOK_URL,
  }),
);

export type OperationsAdminNoticesConfig = ConfigType<typeof operationsAdminNoticesConfig>;
