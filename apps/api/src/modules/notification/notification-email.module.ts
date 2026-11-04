import { Module } from "@nestjs/common";

import { TypedConfigService } from "#api/platform/config/services/config.service";
import { OutboundPolicyRegistry } from "#api/platform/resilience/outbound-policy.registry";

import { EMAIL_DELIVERY_QUEUE_PORT } from "./application/ports/email/email-delivery-queue.port.js";
import { EMAIL_SENDER } from "./application/ports/email/email-sender.port.js";
import { TransactionalEmailSender } from "./application/senders/email/transactional-email.sender.js";
import { EmailDeliveryQueueAdapter } from "./infrastructure/adapters/email/email-delivery-queue.adapter.js";
import { createEmailSender } from "./infrastructure/adapters/email/email-sender.factory.js";
import { EmailDeliveryQueueProcessor } from "./infrastructure/jobs/email/email-delivery-queue.processor.js";
import {
  deliverEmailProvider,
  emailBudgetProvider,
  transactionalEmailSenderProvider,
} from "./notification-email-application.providers.js";

/**
 * 이메일 모듈 (클린아키텍처 capability — 컨트롤러 없음)
 *
 * 트랜잭셔널 이메일(인증·비밀번호·문의·신고)을 `email-delivery.v1` 큐로 비동기 발송한다.
 * 전송 벤더는 EMAIL_SENDER 포트 하나이고 EMAIL_PROVIDER 설정으로 어댑터를 고른다.
 * TransactionalEmailSender를 export하여 소비 모듈이 주입한다.
 */
@Module({
  providers: [
    emailBudgetProvider,
    transactionalEmailSenderProvider,
    deliverEmailProvider,
    EmailDeliveryQueueProcessor,
    { provide: EMAIL_DELIVERY_QUEUE_PORT, useClass: EmailDeliveryQueueAdapter },
    {
      provide: EMAIL_SENDER,
      useFactory: createEmailSender,
      inject: [TypedConfigService, OutboundPolicyRegistry],
    },
  ],
  exports: [TransactionalEmailSender],
})
export class NotificationEmailModule {}
