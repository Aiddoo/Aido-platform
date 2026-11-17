import { Logger, type Provider } from "@nestjs/common";
import { Mailer } from "@nestjs/mail";

import { loggerFor, provideUseCase } from "#api/platform/di/provide-use-case";
import { UsageMeterPort } from "#api/platform/metering/usage-meter.port";
import { OutboundPolicyRegistry } from "#api/platform/resilience/outbound-policy.registry";
import { ClockPort } from "#api/shared/application/ports/clock.port";
import { OperationalAlertPort } from "#api/shared/application/ports/operational-alert.port";

import { EmailBudgetPort } from "./application/ports/email-budget.port.js";
import { EmailDeliveryQueuePort } from "./application/ports/email-delivery-queue.port.js";
import { EmailSenderPort } from "./application/ports/email-sender.port.js";
import { EmailTemplateRendererPort } from "./application/ports/email-template-renderer.port.js";
import { DeliverEmailUseCase } from "./application/use-cases/deliver-email.use-case.js";
import { SendTransactionalEmailUseCase } from "./application/use-cases/send-transactional-email.use-case.js";
import { selectEmailSender } from "./infrastructure/adapters/email-sender-factory.adapter.js";
import { MeteredEmailBudgetAdapter } from "./infrastructure/adapters/metered-email-budget.adapter.js";
import { NestMailEmailSenderAdapter } from "./infrastructure/adapters/nest-mail-email-sender.adapter.js";
import { EmailDeliveryQueueAdapter } from "./infrastructure/jobs/email-delivery-queue.adapter.js";
import { EmailTemplateMail } from "./infrastructure/templates/email-template.mail.js";
import {
  notificationEmailMessagesConfig,
  type NotificationEmailMessagesConfig,
} from "./notification-email-messages.config.js";

const NOTIFICATION_EMAIL_MESSAGES_QUEUE_PROVIDERS = [
  { provide: EmailDeliveryQueuePort, useClass: EmailDeliveryQueueAdapter },
] satisfies Provider[];

// 렌더는 공급자와 상관없이 Mailer가 메일 클래스로 맡고, 전송 어댑터는 EMAIL_PROVIDER(비우면 배포 환경 기본값)로 고른다
const NOTIFICATION_EMAIL_MESSAGES_EXTERNAL_PROVIDERS = [
  {
    provide: EmailTemplateMail,
    inject: [notificationEmailMessagesConfig.KEY],
    useFactory: (config: NotificationEmailMessagesConfig) =>
      new EmailTemplateMail(config.supportEmail),
  },
  {
    provide: NestMailEmailSenderAdapter,
    inject: [Mailer, OutboundPolicyRegistry, notificationEmailMessagesConfig.KEY],
    useFactory: (
      mailer: Mailer,
      policies: OutboundPolicyRegistry,
      config: NotificationEmailMessagesConfig,
    ) => new NestMailEmailSenderAdapter({ mailer, policies, isConfigured: config.apiKey != null }),
  },
  { provide: EmailTemplateRendererPort, useExisting: NestMailEmailSenderAdapter },
  {
    provide: EmailSenderPort,
    inject: [notificationEmailMessagesConfig.KEY, NestMailEmailSenderAdapter],
    useFactory: (config: NotificationEmailMessagesConfig, nestMail: NestMailEmailSenderAdapter) =>
      selectEmailSender(config.provider, nestMail),
  },
  {
    provide: EmailBudgetPort,
    inject: [UsageMeterPort, OperationalAlertPort, ClockPort],
    useFactory: (meter: UsageMeterPort, alert: OperationalAlertPort, clock: ClockPort) =>
      new MeteredEmailBudgetAdapter({
        meter,
        alert,
        clock,
        logger: new Logger(MeteredEmailBudgetAdapter.name),
      }),
  },
] satisfies Provider[];

const NOTIFICATION_EMAIL_MESSAGES_USE_CASE_PROVIDERS = [
  provideUseCase(SendTransactionalEmailUseCase, {
    queue: EmailDeliveryQueuePort,
    sender: EmailSenderPort,
    budget: EmailBudgetPort,
    renderer: EmailTemplateRendererPort,
    logger: loggerFor(SendTransactionalEmailUseCase),
  }),
  provideUseCase(DeliverEmailUseCase, {
    sender: EmailSenderPort,
    budget: EmailBudgetPort,
    alert: OperationalAlertPort,
    logger: loggerFor(DeliverEmailUseCase),
  }),
] satisfies Provider[];

export const NOTIFICATION_EMAIL_MESSAGES_PROVIDERS = [
  ...NOTIFICATION_EMAIL_MESSAGES_QUEUE_PROVIDERS,
  ...NOTIFICATION_EMAIL_MESSAGES_EXTERNAL_PROVIDERS,
  ...NOTIFICATION_EMAIL_MESSAGES_USE_CASE_PROVIDERS,
] satisfies Provider[];
