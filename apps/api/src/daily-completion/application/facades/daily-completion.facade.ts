import { Injectable } from "@nestjs/common";
import type { DailyCompletionsRange } from "../../domain/daily-completion";
import { GetDailyCompletionsUseCase } from "../queries/get-daily-completions/get-daily-completions.use-case";

/**
 * 일일 완료 애플리케이션 서비스(Facade) — 컨트롤러와 use-case 사이의 얇은 seam.
 */
@Injectable()
export class DailyCompletionFacade {
	constructor(
		private readonly getDailyCompletionsUseCase: GetDailyCompletionsUseCase,
	) {}

	getDailyCompletions(
		userId: string,
		startDate: string,
		endDate: string,
	): Promise<DailyCompletionsRange> {
		return this.getDailyCompletionsUseCase.execute({
			userId,
			startDate,
			endDate,
		});
	}
}
