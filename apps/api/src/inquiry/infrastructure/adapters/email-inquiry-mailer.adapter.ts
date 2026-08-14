import { Injectable } from "@nestjs/common";
import { TransactionalEmailSender } from "@/email";
import { TypedConfigService } from "@/shared/infrastructure/config/services/config.service";
import type {
	InquiryDeliveryResult,
	InquiryMailerPort,
} from "../../application/ports/inquiry-mailer.port";
import type { InquirySubmission } from "../../domain/services/inquiry-submission";

/**
 * InquiryMailerPort의 이메일(Resend) 어댑터.
 *
 * 문의 제출을 담당자 이메일로 전달한다. 수신 주소(supportEmail)는 인프라
 * 설정에서 읽어 application 계층으로 누출하지 않는다. 벤더를 슬랙/웹훅으로
 * 바꾸려면 이 어댑터만 교체하면 된다.
 */
@Injectable()
export class EmailInquiryMailerAdapter implements InquiryMailerPort {
	constructor(
		private readonly emailSender: TransactionalEmailSender,
		private readonly configService: TypedConfigService,
	) {}

	async deliver(submission: InquirySubmission): Promise<InquiryDeliveryResult> {
		const supportEmail = this.configService.email.supportEmail;

		const result = await this.emailSender.sendInquiry(supportEmail, {
			userEmail: submission.userEmail,
			category: submission.category,
			categoryLabel: submission.categoryLabel,
			content: submission.content,
			submittedAt: submission.submittedAt,
		});

		return { success: result.success, error: result.error };
	}
}
