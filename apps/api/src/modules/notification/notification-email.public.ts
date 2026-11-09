export {
  TransactionalEmailSender,
  type EmailDispatch,
  type EmailSendResult,
} from "./application/senders/email/transactional-email.sender.js";
export type { InquiryTemplateData } from "./application/templates/email/inquiry.template.js";
export type { UserReportTemplateData } from "./application/templates/email/user-report.template.js";
export { NotificationEmailModule } from "./notification-email.module.js";
