export {
  SendTransactionalEmailUseCase,
  // 다른 Context가 옮길 때까지 옛 이름을 같은 클래스로 남긴다
  SendTransactionalEmailUseCase as TransactionalEmailSender,
  type EmailDispatch,
  type EmailSendResult,
} from "./email/application/use-cases/send-transactional-email.use-case.js";
export type {
  InquiryTemplateData,
  UserReportTemplateData,
} from "./email/application/ports/email-template-renderer.port.js";
export { NotificationEmailModule } from "./email/notification-email.module.js";
