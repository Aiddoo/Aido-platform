import { z } from "zod";

import type { AppEnvironment } from "./app.schema.js";

/** 관리자 알림 어댑터. 어댑터를 더하면 여기와 admin-notifier-selection 표에 한 줄씩 더한다. */
export const ADMIN_NOTIFIER_PROVIDERS = ["discord", "log"] as const;
export type AdminNotifierProviderId = (typeof ADMIN_NOTIFIER_PROVIDERS)[number];

/** ADMIN_NOTIFIER_PROVIDER가 비었을 때의 어댑터. 개발 환경은 Discord 웹훅이 있을 때만 실제로 보낸다. */
export function defaultAdminNotifierProvider(
  environment: AppEnvironment,
  hasWebhookUrl: boolean,
): AdminNotifierProviderId {
  return environment !== "development" || hasWebhookUrl ? "discord" : "log";
}

export const webhookSchema = z.object({
  /** 관리자 알림 어댑터. log는 보내지 않고 로그만 남긴다. 비우면 배포 환경이 정한다(operations-admin-notices.config.ts) */
  ADMIN_NOTIFIER_PROVIDER: z.enum(ADMIN_NOTIFIER_PROVIDERS).optional(),

  DISCORD_SIGNUP_WEBHOOK_URL: z
    .string()
    .optional()
    .refine((val) => !val || val.startsWith("https://discord.com/api/webhooks/"), {
      message:
        "DISCORD_SIGNUP_WEBHOOK_URL must be a valid Discord webhook URL (https://discord.com/api/webhooks/...)",
    }),
  DISCORD_PAYMENT_WEBHOOK_URL: z
    .string()
    .optional()
    .refine((val) => !val || val.startsWith("https://discord.com/api/webhooks/"), {
      message:
        "DISCORD_PAYMENT_WEBHOOK_URL must be a valid Discord webhook URL (https://discord.com/api/webhooks/...)",
    }),
});

export type WebhookConfig = z.infer<typeof webhookSchema>;
