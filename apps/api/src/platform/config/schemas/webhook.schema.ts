import { z } from "zod";

/** 관리자 알림 어댑터. 어댑터를 더하면 여기와 admin-notifier.factory.ts 표에 한 줄씩 더한다. */
export const ADMIN_NOTIFIER_PROVIDERS = ["discord", "log"] as const;
export type AdminNotifierProviderId = (typeof ADMIN_NOTIFIER_PROVIDERS)[number];

export const webhookSchema = z.object({
  /** 관리자 알림 어댑터. log는 개발·테스트용으로 보내지 않고 로그만 남긴다 */
  ADMIN_NOTIFIER_PROVIDER: z.enum(ADMIN_NOTIFIER_PROVIDERS).default("discord"),

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
