import type { ConfigType } from "@nestjs/config";

import { defineConfig } from "#api/platform/config/define-config";
import { webhookSchema } from "#api/platform/config/schemas/webhook.schema";

/** 관리자 알림 어댑터와 Discord 웹훅(가입·결제 채널). */
export const operationsAdminNoticesConfig = defineConfig(
  "operationsAdminNotices",
  webhookSchema.transform((env) => ({
    provider: env.ADMIN_NOTIFIER_PROVIDER,
    discordWebhookUrls: {
      admin: env.DISCORD_SIGNUP_WEBHOOK_URL,
      payment: env.DISCORD_PAYMENT_WEBHOOK_URL,
    },
  })),
  (env) => ({
    ADMIN_NOTIFIER_PROVIDER: env.ADMIN_NOTIFIER_PROVIDER,
    DISCORD_SIGNUP_WEBHOOK_URL: env.DISCORD_SIGNUP_WEBHOOK_URL,
    DISCORD_PAYMENT_WEBHOOK_URL: env.DISCORD_PAYMENT_WEBHOOK_URL,
  }),
);

export type OperationsAdminNoticesConfig = ConfigType<typeof operationsAdminNoticesConfig>;
