import { z } from "zod";

/**
 * 이메일 설정 (Resend)
 */
export const emailSchema = z.object({
	/** Resend API Key */
	RESEND_API_KEY: z.string().optional(),

	/** 발신자 이메일 주소 */
	EMAIL_FROM: z.string().email().default("noreply@example.com"),

	/** 발신자 이름 */
	EMAIL_FROM_NAME: z.string().default("Aido"),
});

export type EmailConfig = z.infer<typeof emailSchema>;

/**
 * Production 환경에서 이메일 필수 검증
 */
export function validateEmailForProduction(config: EmailConfig): boolean {
	return !!config.RESEND_API_KEY;
}
