/**
 * 이메일 태그 (Resend API 형식)
 */
export interface EmailTag {
	name: string;
	value: string;
}

/**
 * 이메일 발송 옵션
 */
export interface EmailSendOptions {
	to: string;
	subject: string;
	html: string;
	text: string;
	/** 중복 발송 방지를 위한 고유 키 */
	idempotencyKey?: string;
	/** 이메일 추적을 위한 태그 */
	tags?: EmailTag[];
}

/**
 * 이메일 발송 결과
 */
export interface EmailSendResult {
	success: boolean;
	messageId?: string;
	error?: string;
	/** 재시도 횟수 (디버깅용) */
	retryCount?: number;
}

/**
 * 이메일 타입 (태그용)
 */
export type EmailType = "verification" | "password-reset" | "notification";
