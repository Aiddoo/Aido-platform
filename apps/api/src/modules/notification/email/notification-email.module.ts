import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { MailModule } from "@nestjs/mail";

import { SendTransactionalEmailUseCase } from "./application/use-cases/send-transactional-email.use-case.js";
import {
  createEmailTemplateEngine,
  createMailModuleOptions,
} from "./infrastructure/adapters/nest-mail-module.config.js";
import { EmailDeliveryQueueProcessor } from "./infrastructure/jobs/email-delivery-queue.processor.js";
import { notificationEmailConfig } from "./notification-email.config.js";
import { NOTIFICATION_EMAIL_PROVIDERS } from "./notification-email.providers.js";

// 트랜잭셔널 메일(인증·비밀번호·문의·신고)을 템플릿 파일로 렌더해 email-delivery.v1 큐로 보낸다
@Module({
  imports: [
    ConfigModule.forFeature(notificationEmailConfig),
    // Mailer는 이 slice만 쓰므로 전역으로 열지 않는다
    MailModule.forRootAsync({
      isGlobal: false,
      templates: createEmailTemplateEngine(),
      imports: [ConfigModule.forFeature(notificationEmailConfig)],
      inject: [notificationEmailConfig.KEY],
      useFactory: createMailModuleOptions,
    }),
  ],
  providers: [...NOTIFICATION_EMAIL_PROVIDERS, EmailDeliveryQueueProcessor],
  exports: [SendTransactionalEmailUseCase],
})
export class NotificationEmailModule {}
