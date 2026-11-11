import { z } from "zod";

import type { AppEnvironment } from "./app.schema.js";

/** 이메일 발송 어댑터. 어댑터를 더하면 여기와 email-sender-factory·nest-mail-module.config 표에 한 줄씩 더한다. */
const EMAIL_PROVIDERS = ["resend", "log"] as const;
export type EmailProviderId = (typeof EMAIL_PROVIDERS)[number];

/** EMAIL_PROVIDER가 비었을 때의 발송 어댑터. 개발 환경은 Resend 키가 있을 때만 실제로 보낸다. */
export function defaultEmailProvider(
  environment: AppEnvironment,
  apiKey: string | null,
): EmailProviderId {
  return environment !== "development" || apiKey != null ? "resend" : "log";
}

/**
 * 이메일 설정
 */
export const emailSchema = z.object({
  /** 발송 어댑터. log는 보내지 않고 로그만 남긴다. 비우면 배포 환경이 정한다(notification-email.config.ts) */
  EMAIL_PROVIDER: z.enum(EMAIL_PROVIDERS).optional(),

  /** Resend API Key */
  RESEND_API_KEY: z.string().optional(),

  /** 발신자 이메일 주소 */
  EMAIL_FROM: z.email().default("noreply@aido.kr"),

  /** 발신자 이름 */
  EMAIL_FROM_NAME: z.string().default("Aido"),

  /** 문의 수신 이메일 */
  SUPPORT_EMAIL: z.email().default("support@aido.kr"),
});

export type EmailConfig = z.infer<typeof emailSchema>;
