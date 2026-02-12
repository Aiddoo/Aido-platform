import type { InquiryCategory } from "@aido/validators";
import { Injectable, Logger } from "@nestjs/common";
import { TypedConfigService } from "@/common/config/services/config.service";
import { BusinessExceptions } from "@/common/exception/services/business-exception.service";
import { EmailService } from "@/modules/email/email.service";

const CATEGORY_LABELS: Record<InquiryCategory, string> = {
	BUG_REPORT: "버그 신고",
	FEATURE_REQUEST: "기능 요청",
	OTHER: "기타",
};

interface CreateInquiryParams {
	userId: string;
	userEmail: string;
	category: InquiryCategory;
	content: string;
}

@Injectable()
export class InquiryService {
	private readonly logger = new Logger(InquiryService.name);

	constructor(
		private readonly emailService: EmailService,
		private readonly configService: TypedConfigService,
	) {}

	async createInquiry(params: CreateInquiryParams): Promise<void> {
		const { userId, userEmail, category, content } = params;
		const supportEmail = this.configService.email.supportEmail;
		const categoryLabel = CATEGORY_LABELS[category];

		const result = await this.emailService.sendInquiry(supportEmail, {
			userEmail,
			category,
			categoryLabel,
			content,
			submittedAt: new Date().toISOString(),
		});

		if (!result.success) {
			throw BusinessExceptions.inquiryEmailFailed({
				userId,
				error: result.error,
			});
		}

		this.logger.log(
			`Inquiry submitted: userId=${userId}, category=${category}`,
		);
	}
}
