import type { InquiryCategory } from "@aido/validators";
import { Injectable } from "@nestjs/common";
import { CommandBus } from "@nestjs/cqrs";
import { CreateInquiryCommand } from "../use-cases/create-inquiry/create-inquiry.command";

/**
 * 문의 애플리케이션 서비스(Facade) — 컨트롤러와 CommandBus 사이의 얇은 seam.
 * 컨트롤러는 이 Facade만 주입받는다.
 */
@Injectable()
export class InquiryFacade {
	constructor(private readonly commandBus: CommandBus) {}

	createInquiry(
		userId: string,
		userEmail: string,
		category: InquiryCategory,
		content: string,
	): Promise<void> {
		return this.commandBus.execute(
			new CreateInquiryCommand(userId, userEmail, category, content),
		);
	}
}
