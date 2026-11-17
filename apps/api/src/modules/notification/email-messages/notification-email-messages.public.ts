export { NotificationEmailMessagesModule } from "./notification-email-messages.module.js";
export {
  SendTransactionalEmailUseCase,
  type EmailDispatch,
  type EmailSendResult,
} from "./application/use-cases/send-transactional-email.use-case.js";
export type {
  InquiryTemplateData,
  UserReportTemplateData,
} from "./application/ports/email-template-renderer.port.js";
