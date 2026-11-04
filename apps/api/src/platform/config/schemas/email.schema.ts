import { z } from "zod";

/** 이메일 발송 어댑터. 어댑터를 더하면 여기와 email-sender.factory.ts 표에 한 줄씩 더한다. */
export const EMAIL_PROVIDERS = ["resend", "log"] as const;
export type EmailProviderId = (typeof EMAIL_PROVIDERS)[number];

/**
 * 이메일 설정
 */
export const emailSchema = z.object({
  /** 발송 어댑터. log는 개발·테스트용으로 보내지 않고 로그만 남긴다 */
  EMAIL_PROVIDER: z.enum(EMAIL_PROVIDERS).default("resend"),

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

/**
 * Production 환경에서는 실제로 발송하는 어댑터와 그 키가 필수
 */
export function validateEmailForProduction(config: EmailConfig): boolean {
  return config.EMAIL_PROVIDER === "resend" && !!config.RESEND_API_KEY;
}
