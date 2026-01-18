import { Injectable, Logger } from "@nestjs/common";
import dayjs from "dayjs";
import utc from "dayjs/plugin/utc";
import { mapToCompletionSummaries } from "./daily-completion.mapper";
import { DailyCompletionRepository } from "./daily-completion.repository";
import type {
	DailyCompletionsRangeResult,
	GetDailyCompletionsRangeParams,
} from "./types/daily-completion.types";

// UTC 플러그인 활성화
dayjs.extend(utc);

// 타입 재내보내기 (기존 import 호환성 유지)
export type {
	DailyCompletionSummary,
	DailyCompletionsRangeResult,
	GetDailyCompletionsRangeParams,
} from "./types/daily-completion.types";

@Injectable()
export class DailyCompletionService {
	private readonly logger = new Logger(DailyCompletionService.name);

	constructor(
		private readonly dailyCompletionRepository: DailyCompletionRepository,
	) {}

	/**
	 * 날짜 범위 내 일일 완료 현황을 조회합니다 (캘린더용)
	 *
	 * @param params - 조회 파라미터 (userId, startDate, endDate)
	 * @returns 날짜별 완료 현황 및 통계
	 */
	async getDailyCompletionsRange(
		params: GetDailyCompletionsRangeParams,
	): Promise<DailyCompletionsRangeResult> {
		const { userId, startDate, endDate } = params;

		const start = dayjs.utc(startDate).startOf("day").toDate();
		const end = dayjs.utc(endDate).add(1, "day").startOf("day").toDate();

		const aggregates =
			await this.dailyCompletionRepository.aggregateTodosByDateRange({
				userId,
				startDate: start,
				endDate: end,
			});

		const completions = mapToCompletionSummaries(aggregates);
		const totalCompleteDays = completions.filter((c) => c.isComplete).length;

		this.logger.debug(
			`Daily completions retrieved: ${completions.length} days for user: ${userId}, complete days: ${totalCompleteDays}`,
		);

		return {
			completions,
			totalCompleteDays,
			dateRange: { startDate, endDate },
		};
	}
}
