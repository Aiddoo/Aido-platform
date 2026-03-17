import { Injectable } from "@nestjs/common";

import { addDays } from "@/common/date/utils/arithmetic";
import { toDateString } from "@/common/date/utils/format";
import { startOfDay } from "@/common/date/utils/range";
import { DatabaseService } from "@/database/database.service";
import type {
	FindTodosByDateRangeParams,
	TodoAggregateByDate,
	TodoCountByDate,
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

		// 병렬로 전체 Todo, 완료 Todo, 카테고리 색상 집계 실행
		const [aggregations, completedAggregations, categoryColorResults] =
			await Promise.all([
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
				this.database.todo.findMany({
					where: whereClause,
					select: {
						startDate: true,
						category: { select: { color: true } },
					},
					distinct: ["startDate", "categoryId"],
				}),
			]);

		// 완료 수를 Map으로 변환하여 O(1) 조회
		const completedMap = new Map(
			completedAggregations.map((item) => [
				toDateString(item.startDate),
				item._count.id,
			]),
		);

		// 카테고리 색상을 날짜별로 그룹화 (Set으로 동일 색상 중복 제거)
		const colorMap = new Map<string, Set<string>>();
		for (const item of categoryColorResults) {
			const key = toDateString(item.startDate);
			const colors = colorMap.get(key) ?? new Set<string>();
			colors.add(item.category.color);
			colorMap.set(key, colors);
		}

		return aggregations.map((item) => {
			const dateKey = toDateString(item.startDate);
			return {
				date: item.startDate,
				total: item._count.id,
				completed: completedMap.get(dateKey) ?? 0,
				categoryColors: [...(colorMap.get(dateKey) ?? [])],
			};
		});
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
	): Promise<TodoCountByDate | null> {
		const dayStart = startOfDay(date);
		const dayEnd = addDays(1, dayStart);

		const whereClause = {
			userId,
			startDate: { gte: dayStart, lt: dayEnd },
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
