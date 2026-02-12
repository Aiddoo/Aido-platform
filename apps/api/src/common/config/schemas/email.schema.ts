import { z } from "zod";

/**
 * 이메일 설정 (Resend)
 */
export const emailSchema = z.object({
	/** Resend API Key */
	RESEND_API_KEY: z.string().optional(),

	/** 발신자 이메일 주소 */
	EMAIL_FROM: z.email().default("dydals3440@gmail.com"),

	/** 발신자 이름 */
	EMAIL_FROM_NAME: z.string().default("Aido"),

	/** 문의 수신 이메일 */
	SUPPORT_EMAIL: z.email().default("dydals3440@gmail.com"),
});

export type EmailConfig = z.infer<typeof emailSchema>;

/**
 * Production 환경에서 이메일 필수 검증
 */
export function validateEmailForProduction(config: EmailConfig): boolean {
	return !!config.RESEND_API_KEY;
}
