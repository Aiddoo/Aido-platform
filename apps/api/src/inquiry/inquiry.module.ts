import { Module } from "@nestjs/common";
import { CqrsModule } from "@nestjs/cqrs";
import { EmailModule } from "@/email/email.module";
import { InquiryFacade } from "./application/facades/inquiry.facade";
import { INQUIRY_MAILER } from "./application/ports/inquiry-mailer.port";
import { CommandHandlers } from "./application/use-cases";
import { EmailInquiryMailerAdapter } from "./infrastructure/adapters/email-inquiry-mailer.adapter";
import { InquiryController } from "./presentation/inquiry.controller";

/**
 * 문의 모듈 (클린아키텍처)
 *
 * 사용자 문의를 담당자에게 전달한다. 전달 채널은 InquiryMailerPort로 추상화되며,
 * 현재 어댑터는 이메일(Resend)이다 — 슬랙/웹훅으로 바꾸려면 어댑터만 교체한다.
 */
@Module({
	imports: [CqrsModule, EmailModule],
	controllers: [InquiryController],
	providers: [
		InquiryFacade,
		{ provide: INQUIRY_MAILER, useClass: EmailInquiryMailerAdapter },
		...CommandHandlers,
	],
})
export class InquiryModule {}
