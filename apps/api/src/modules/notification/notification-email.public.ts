/**
 * Email 모듈 공개 API
 *
 * Facade는 소비 모듈(inquiry·auth)용, 도메인 값 객체·발송 결과·템플릿 데이터
 * 타입은 계약.
 */

export * from "./application/ports/email/email-sender.port.js";
export * from "./application/senders/email/transactional-email.sender.js";
export * from "./domain/templates/email/index.js";
export {
  EmailMessage,
  type EmailTag,
  type EmailType,
} from "./domain/value-objects/email/email-message.vo.js";
export * from "./notification-email.module.js";
