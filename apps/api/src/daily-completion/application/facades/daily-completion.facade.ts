import { Injectable } from "@nestjs/common";
import { QueryBus } from "@nestjs/cqrs";
import type { DailyCompletionsRange } from "../../domain/daily-completion";
import { GetDailyCompletionsQuery } from "../queries/get-daily-completions.query";

/**
 * 일일 완료 애플리케이션 서비스(Facade) — 컨트롤러와 QueryBus 사이의 얇은 seam.
 */
@Injectable()
export class DailyCompletionFacade {
	constructor(private readonly queryBus: QueryBus) {}

	getDailyCompletions(
		userId: string,
		startDate: string,
		endDate: string,
	): Promise<DailyCompletionsRange> {
		return this.queryBus.execute(
			new GetDailyCompletionsQuery(userId, startDate, endDate),
		);
	}
}
