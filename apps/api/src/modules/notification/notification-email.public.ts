export {
  TransactionalEmailSender,
  type EmailDispatch,
  type EmailSendResult,
} from "./email/application/use-cases/send-transactional-email.use-case.js";
export type { InquiryTemplateData } from "./email/application/templates/inquiry-template.messages.js";
export type { UserReportTemplateData } from "./email/application/templates/user-report-template.messages.js";
export { NotificationEmailModule } from "./email/notification-email.module.js";
