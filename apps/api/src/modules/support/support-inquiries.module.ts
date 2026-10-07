import { Module } from "@nestjs/common";

import { EmailModule } from "#api/modules/notification/notification-email.module";

import { INQUIRY_MAILER } from "./application/ports/inquiries/inquiry-mailer.port.js";
import { EmailInquiryMailerAdapter } from "./infrastructure/adapters/inquiries/email-inquiry-mailer.adapter.js";
import { InquiryController } from "./presentation/controllers/inquiries/inquiry.controller.js";
import { INQUIRY_PROVIDERS } from "./support-inquiries.providers.js";

/**
 * 문의 모듈 (클린아키텍처)
 *
 * 사용자 문의를 담당자에게 전달한다. 전달 채널은 InquiryMailerPort로 추상화되며,
 * 현재 어댑터는 이메일(Resend)이다 — 슬랙/웹훅으로 바꾸려면 어댑터만 교체한다.
 */
@Module({
  imports: [EmailModule],
  controllers: [InquiryController],
  providers: [
    { provide: INQUIRY_MAILER, useClass: EmailInquiryMailerAdapter },
    ...INQUIRY_PROVIDERS,
  ],
})
export class InquiryModule {}
