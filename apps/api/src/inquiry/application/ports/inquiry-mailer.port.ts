import type { InquirySubmission } from "../../domain/services/inquiry-submission";

/** InquiryMailerPort DI 토큰 */
export const INQUIRY_MAILER = Symbol("INQUIRY_MAILER");

/** 문의 전달 결과 (성공 여부 + 실패 사유) */
export interface InquiryDeliveryResult {
	readonly success: boolean;
	readonly error?: string;
}

/**
 * 문의 전달 포트 — 벤더 중립 계약.
 *
 * 문의 한 건을 담당자에게 전달한다. 실제 전달 수단(Resend 이메일, 슬랙,
 * 웹훅 등)은 인프라 어댑터가 결정하며, 어댑터만 교체하면 채널을 바꿀 수 있다.
 * 테스트는 실제 전송 대신 스텁 어댑터로 대체한다.
 */
export interface InquiryMailerPort {
	deliver(submission: InquirySubmission): Promise<InquiryDeliveryResult>;
}
