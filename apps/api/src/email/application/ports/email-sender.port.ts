import type { EmailMessage } from "../../domain/value-objects/email-message.vo";

/** EmailSenderPort DI 토큰 */
export const EMAIL_SENDER = Symbol("EMAIL_SENDER");

/** 이메일 발송 결과 */
export interface EmailSendResult {
	success: boolean;
	messageId?: string;
	error?: string;
	/** 재시도 횟수 (디버깅용) */
	retryCount?: number;
}

/**
 * 이메일 전송 포트 (벤더 중립 트랜스포트).
 *
 * 결제(Payment) 인터페이스처럼 전송 벤더를 캡슐화한다 — 현재 어댑터는 Resend이며,
 * GoogleSMS·SES·Slack 등으로 바꾸려면 이 포트의 어댑터만 교체하면 된다. 재시도·
 * 백오프·미설정 시 폴백 같은 트랜스포트 관심사는 어댑터가 소유한다.
 */
export interface EmailSenderPort {
	send(message: EmailMessage): Promise<EmailSendResult>;
}
