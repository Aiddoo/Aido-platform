import { Query } from "@nestjs/cqrs";
import type { CursorPaginationInfo } from "@/shared/application/pagination";
import type {
	WeekLabelLocale,
	WeeklyAchievementSummary,
	WeeklyAchievementView,
} from "../../domain/weekly-achievement";

/** 주간 달성 목록 뷰 (아이템 + 커서 페이지네이션 + 연도 요약) */
export interface WeeklyAchievementListView {
	items: WeeklyAchievementView[];
	pagination: CursorPaginationInfo<number>;
	summary: WeeklyAchievementSummary;
}

/**
 * 연도별 주간 달성 목록 조회 쿼리 (커서 페이지네이션 + summary, 읽기 전용).
 */
export class GetWeeklyAchievementsQuery extends Query<WeeklyAchievementListView> {
	constructor(
		public readonly userId: string,
		public readonly year: number,
		public readonly cursor: number | undefined,
		public readonly size: number | undefined,
		public readonly locale: WeekLabelLocale,
	) {
		super();
	}
}
