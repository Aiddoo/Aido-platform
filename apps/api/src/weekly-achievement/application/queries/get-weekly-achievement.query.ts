import { Query } from "@nestjs/cqrs";
import type {
	WeekLabelLocale,
	WeeklyAchievementView,
} from "../../domain/weekly-achievement";

/**
 * 특정 연도/주차의 주간 달성 상세 조회 쿼리 (읽기 전용).
 */
export class GetWeeklyAchievementQuery extends Query<WeeklyAchievementView> {
	constructor(
		public readonly userId: string,
		public readonly year: number,
		public readonly week: number,
		public readonly locale: WeekLabelLocale,
	) {
		super();
	}
}
