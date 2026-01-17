import { Injectable, Logger } from "@nestjs/common";
import dayjs from "dayjs";
import utc from "dayjs/plugin/utc";
import { mapToCompletionSummaries } from "./daily-completion.mapper";
import { DailyCompletionRepository } from "./daily-completion.repository";

// UTC 플러그인 활성화
dayjs.extend(utc);

/**
 * 일일 완료 현황 조회 파라미터
 */
export interface GetDailyCompletionsRangeParams {
	userId: string;
	startDate: string;
	endDate: string;
}

/**
 * 일일 완료 요약 정보
 */
export interface DailyCompletionSummary {
	date: string;
	totalTodos: number;
	completedTodos: number;
	isComplete: boolean;
	completionRate: number;
}

/**
 * 일일 완료 현황 조회 결과
 */
export interface DailyCompletionsRangeResult {
	completions: DailyCompletionSummary[];
	totalCompleteDays: number;
	dateRange: {
		startDate: string;
		endDate: string;
	};
}

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
