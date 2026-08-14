import { Injectable } from "@nestjs/common";
import type { DailyCompletionsRange } from "../../domain/daily-completion";
import { GetDailyCompletionsUseCase } from "../queries/get-daily-completions/get-daily-completions.use-case";
import { GetFriendDailyCompletionsUseCase } from "../queries/get-friend-daily-completions/get-friend-daily-completions.use-case";

/** @deprecated 전환 중인 통합 테스트 호환 seam. HTTP에서는 직접 UseCase를 사용한다. */
@Injectable()
export class DailyCompletionFacade {
	constructor(
		private readonly getDailyCompletionsUseCase: GetDailyCompletionsUseCase,
		private readonly getFriendDailyCompletionsUseCase: GetFriendDailyCompletionsUseCase,
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

	getFriendDailyCompletions(
		userId: string,
		friendUserId: string,
		startDate: string,
		endDate: string,
	): Promise<DailyCompletionsRange> {
		return this.getFriendDailyCompletionsUseCase.execute({
			userId,
			friendUserId,
			startDate,
			endDate,
		});
	}
}
