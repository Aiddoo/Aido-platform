import { Module } from "@nestjs/common";

import { EMAIL_SENDER } from "./application/ports/email/email-sender.port.js";
import { TransactionalEmailSender } from "./application/senders/email/transactional-email.sender.js";
import { ResendEmailSenderAdapter } from "./infrastructure/adapters/email/resend-email-sender.adapter.js";
import { transactionalEmailSenderProvider } from "./notification-email-application.providers.js";

/**
 * 이메일 모듈 (클린아키텍처 capability — 컨트롤러 없음)
 *
 * 트랜잭셔널 이메일(인증·비밀번호·문의)을 발송한다. 전송 벤더는 EMAIL_SENDER
 * 포트로 추상화되며 현재 어댑터는 Resend다. TransactionalEmailSender를
 * export하여 inquiry·auth 등 소비 모듈이 주입한다.
 */
@Module({
  providers: [
    transactionalEmailSenderProvider,
    {
      provide: EMAIL_SENDER,
      useClass: ResendEmailSenderAdapter,
    },
  ],
  exports: [TransactionalEmailSender],
})
export class NotificationEmailModule {}
