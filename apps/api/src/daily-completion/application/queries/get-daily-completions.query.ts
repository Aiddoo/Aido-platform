import { Query } from "@nestjs/cqrs";
import type { DailyCompletionsRange } from "../../domain/daily-completion";

/**
 * 기간별 일일 완료 현황 조회 쿼리 (캘린더용, 읽기 전용).
 */
export class GetDailyCompletionsQuery extends Query<DailyCompletionsRange> {
	constructor(
		public readonly userId: string,
		public readonly startDate: string,
		public readonly endDate: string,
	) {
		super();
	}
}
