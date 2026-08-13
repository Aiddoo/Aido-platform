/**
 * Email 모듈 공개 API
 *
 * Facade는 소비 모듈(inquiry·auth)용, 도메인 값 객체·발송 결과·템플릿 데이터
 * 타입은 계약.
 */

export * from "./application/ports/email-sender.port";
export * from "./application/senders/transactional-email.sender";
export * from "./domain/templates";
export {
	EmailMessage,
	type EmailTag,
	type EmailType,
} from "./domain/value-objects/email-message.vo";
export * from "./email.module";
