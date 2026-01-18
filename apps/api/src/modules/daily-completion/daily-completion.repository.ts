import { Injectable } from "@nestjs/common";
import dayjs from "dayjs";
import utc from "dayjs/plugin/utc";

import { DATE_FORMAT } from "@/common/date";
import { DatabaseService } from "@/database/database.service";
import type {
	FindTodosByDateRangeParams,
	TodoAggregateByDate,
} from "./types/daily-completion.types";

// UTC 플러그인 활성화
dayjs.extend(utc);

// 타입 재내보내기 (기존 import 호환성 유지)
export type {
	FindTodosByDateRangeParams,
	TodoAggregateByDate,
} from "./types/daily-completion.types";

@Injectable()
export class DailyCompletionRepository {
	constructor(private readonly database: DatabaseService) {}

	/**
	 * 날짜 범위 내 Todo를 날짜별로 집계합니다.
	 * 성능 최적화: Prisma groupBy를 사용하여 DB 레벨에서 집계
	 *
	 * @param params - 조회 파라미터
	 * @returns 날짜별 Todo 집계 결과
	 */
	async aggregateTodosByDateRange(
		params: FindTodosByDateRangeParams,
	): Promise<TodoAggregateByDate[]> {
		const { userId, startDate, endDate } = params;

		const whereClause = {
			userId,
			startDate: { gte: startDate, lt: endDate },
		};

		// 병렬로 전체 Todo와 완료 Todo 집계 실행
		const [aggregations, completedAggregations] = await Promise.all([
			this.database.todo.groupBy({
				by: ["startDate"],
				where: whereClause,
				_count: { id: true },
			}),
			this.database.todo.groupBy({
				by: ["startDate"],
				where: { ...whereClause, completed: true },
				_count: { id: true },
			}),
		]);

		// 완료 수를 Map으로 변환하여 O(1) 조회
		const completedMap = new Map(
			completedAggregations.map((item) => [
				dayjs.utc(item.startDate).format(DATE_FORMAT.DATE_ONLY),
				item._count.id,
			]),
		);

		return aggregations.map((item) => ({
			date: item.startDate,
			total: item._count.id,
			completed:
				completedMap.get(
					dayjs.utc(item.startDate).format(DATE_FORMAT.DATE_ONLY),
				) ?? 0,
		}));
	}

	/**
	 * 특정 날짜의 Todo 완료 현황을 조회합니다.
	 *
	 * @param userId - 사용자 ID
	 * @param date - 조회할 날짜
	 * @returns 해당 날짜의 Todo 집계 결과 또는 null
	 */
	async findByDate(
		userId: string,
		date: Date,
	): Promise<TodoAggregateByDate | null> {
		const startOfDay = dayjs.utc(date).startOf("day").toDate();
		const endOfDay = dayjs.utc(date).add(1, "day").startOf("day").toDate();

		const whereClause = {
			userId,
			startDate: { gte: startOfDay, lt: endOfDay },
		};

		const [totalCount, completedCount] = await Promise.all([
			this.database.todo.count({ where: whereClause }),
			this.database.todo.count({ where: { ...whereClause, completed: true } }),
		]);

		if (totalCount === 0) {
			return null;
		}

		return { date, total: totalCount, completed: completedCount };
	}
}
