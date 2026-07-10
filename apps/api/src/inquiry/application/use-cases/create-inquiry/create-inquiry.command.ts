import type { InquiryCategory } from "@aido/validators";
import { Command } from "@nestjs/cqrs";

/**
 * 문의 접수 커맨드
 *
 * 사용자 문의를 담당자에게 전달한다. 전달 실패 시 INQUIRY_1501을 던진다.
 */
export class CreateInquiryCommand extends Command<void> {
	constructor(
		public readonly userId: string,
		public readonly userEmail: string,
		public readonly category: InquiryCategory,
		public readonly content: string,
	) {
		super();
	}
}
