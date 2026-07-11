import type { InquiryCategory } from "@aido/validators";
import { Injectable } from "@nestjs/common";
import { CreateInquiryUseCase } from "../use-cases/create-inquiry/create-inquiry.use-case";

/**
 * 문의 애플리케이션 서비스(Facade) — 컨트롤러와 use-case 사이의 얇은 seam.
 * 컨트롤러는 이 Facade만 주입받는다.
 */
@Injectable()
export class InquiryFacade {
	constructor(private readonly createInquiryUseCase: CreateInquiryUseCase) {}

	createInquiry(
		userId: string,
		userEmail: string,
		category: InquiryCategory,
		content: string,
	): Promise<void> {
		return this.createInquiryUseCase.execute({
			userId,
			userEmail,
			category,
			content,
		});
	}
}
