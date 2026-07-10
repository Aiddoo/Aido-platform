import type {
	CategoryBreakdownItem,
	DayOfWeek,
	DayPatternItem,
	TimePatternItem,
} from "@aido/validators";
import { Injectable, Logger } from "@nestjs/common";
import { TransactionHost } from "@nestjs-cls/transactional";
import type { TransactionalAdapterPrisma } from "@nestjs-cls/transactional-adapter-prisma";
import dayjs from "dayjs";
import type { DatabaseService } from "@/shared/infrastructure/database/database.service";
import type { AggregatedReportData, AggregateParams } from "./types";

/**
 * 요일 인덱스 → DayOfWeek 매핑 (dayjs day(): 0=SUN ~ 6=SAT)
 */
const DAY_INDEX_MAP: Record<number, DayOfWeek> = {
	0: "SUN",
	1: "MON",
	2: "TUE",
	3: "WED",
	4: "THU",
	5: "FRI",
	6: "SAT",
};

/**
 * 리포트 데이터 집계 서비스
 *
 * 할 일 데이터를 집계하여 리포트에 필요한 통계를 생성합니다.
 * N+1 방지를 위해 Promise.all로 모든 쿼리를 병렬 실행합니다.
 */
@Injectable()
export class ReportAggregatorService {
	readonly #logger = new Logger(ReportAggregatorService.name);

	constructor(
		private readonly txHost: TransactionHost<
			TransactionalAdapterPrisma<DatabaseService>
		>,
	) {}

	/** 활성 트랜잭션(없으면 베이스 클라이언트) — CLS로 전파됩니다 */
	private get database() {
		return this.txHost.tx;
	}

	/**
	 * 리포트 데이터 집계
	 *
	 * 1. 현재 기간과 이전 기간의 할 일 통계를 병렬로 쿼리
	 * 2. JS에서 요일별/시간대별/카테고리별 패턴 계산
	 * 3. 연속 달성일(streak) 계산
	 */
	async aggregate(params: AggregateParams): Promise<AggregatedReportData> {
		const { userId, startDate, endDate, prevStartDate, prevEndDate, timezone } =
			params;

		this.#logger.debug(
			`데이터 집계 시작: userId=${userId}, range=${startDate.toISOString()}~${endDate.toISOString()}`,
		);

		// 병렬로 모든 DB 쿼리 실행 (N+1 방지)
		const [
			dailyTotalGroups,
			dailyCompletedGroups,
			prevTotalCount,
			prevCompletedCount,
			catTotalGroups,
			catCompletedGroups,
			categories,
			completedTodos,
		] = await Promise.all([
			// 현재 기간: 날짜별 전체 할 일 수
			this.database.todo.groupBy({
				by: ["startDate"],
				where: { userId, startDate: { gte: startDate, lt: endDate } },
				_count: { id: true },
			}),
			// 현재 기간: 날짜별 완료 할 일 수
			this.database.todo.groupBy({
				by: ["startDate"],
				where: {
					userId,
					startDate: { gte: startDate, lt: endDate },
					completed: true,
				},
				_count: { id: true },
			}),
			// 이전 기간: 전체 할 일 수
			this.database.todo.count({
				where: {
					userId,
					startDate: { gte: prevStartDate, lt: prevEndDate },
				},
			}),
			// 이전 기간: 완료 할 일 수
			this.database.todo.count({
				where: {
					userId,
					startDate: { gte: prevStartDate, lt: prevEndDate },
					completed: true,
				},
			}),
			// 카테고리별 전체 할 일 수
			this.database.todo.groupBy({
				by: ["categoryId"],
				where: { userId, startDate: { gte: startDate, lt: endDate } },
				_count: { id: true },
			}),
			// 카테고리별 완료 할 일 수
			this.database.todo.groupBy({
				by: ["categoryId"],
				where: {
					userId,
					startDate: { gte: startDate, lt: endDate },
					completed: true,
				},
				_count: { id: true },
			}),
			// 카테고리 정보
			this.database.todoCategory.findMany({
				where: { userId },
				select: { id: true, name: true, color: true },
			}),
			// 완료된 할 일 (시간대 분석용)
			this.database.todo.findMany({
				where: {
					userId,
					startDate: { gte: startDate, lt: endDate },
					completed: true,
					completedAt: { not: null },
				},
				select: { startDate: true, completedAt: true },
			}),
		]);

		// 전체/완료 계산
		const totalTodos = dailyTotalGroups.reduce(
			(sum, g) => sum + g._count.id,
			0,
		);
		const completedTodosCount = dailyCompletedGroups.reduce(
			(sum, g) => sum + g._count.id,
			0,
		);
		const completionRate =
			totalTodos > 0 ? Math.round((completedTodosCount / totalTodos) * 100) : 0;

		// 이전 기간 달성률
		const prevCompletionRate =
			prevTotalCount > 0
				? Math.round((prevCompletedCount / prevTotalCount) * 100)
				: null;

		// 카테고리별 집계
		const categoryBreakdown = this.#computeCategoryBreakdown(
			catTotalGroups,
			catCompletedGroups,
			categories,
		);

		// 요일별 패턴 (JS에서 계산)
		const dayPatterns = this.#computeDayPatterns(
			dailyTotalGroups,
			dailyCompletedGroups,
			timezone,
		);

		// 시간대별 패턴
		const timePatterns = this.#computeTimePatterns(completedTodos, timezone);

		// 연속 달성일
		const streakDays = this.#computeStreakDays(
			dailyTotalGroups,
			dailyCompletedGroups,
			startDate,
			endDate,
			timezone,
		);

		const hasActivity = totalTodos > 0;

		return {
			totalTodos,
			completedTodos: completedTodosCount,
			completionRate,
			prevCompletionRate,
			streakDays,
			categoryBreakdown,
			dayPatterns,
			timePatterns,
			hasActivity,
		};
	}

	/**
	 * 카테고리별 집계 계산
	 */
	#computeCategoryBreakdown(
		totalGroups: Array<{ categoryId: number; _count: { id: number } }>,
		completedGroups: Array<{ categoryId: number; _count: { id: number } }>,
		categories: Array<{ id: number; name: string; color: string }>,
	): CategoryBreakdownItem[] {
		const completedMap = new Map(
			completedGroups.map((g) => [g.categoryId, g._count.id]),
		);
		const categoryMap = new Map(categories.map((c) => [c.id, c]));

		return totalGroups
			.map((g) => {
				const category = categoryMap.get(g.categoryId);
				const total = g._count.id;
				const completed = completedMap.get(g.categoryId) ?? 0;
				return {
					name: category?.name ?? "기타",
					color: category?.color ?? "#808080",
					total,
					completed,
					rate: total > 0 ? Math.round((completed / total) * 100) : 0,
				};
			})
			.sort((a, b) => b.total - a.total);
	}

	/**
	 * 요일별 패턴 계산
	 */
	#computeDayPatterns(
		totalGroups: Array<{ startDate: Date; _count: { id: number } }>,
		completedGroups: Array<{ startDate: Date; _count: { id: number } }>,
		timezone: string,
	): DayPatternItem[] {
		const dayTotals = new Map<DayOfWeek, number>();
		const dayCompleted = new Map<DayOfWeek, number>();

		for (const g of totalGroups) {
			const day = DAY_INDEX_MAP[dayjs(g.startDate).tz(timezone).day()] ?? "SUN";
			dayTotals.set(day, (dayTotals.get(day) ?? 0) + g._count.id);
		}

		for (const g of completedGroups) {
			const day = DAY_INDEX_MAP[dayjs(g.startDate).tz(timezone).day()] ?? "SUN";
			dayCompleted.set(day, (dayCompleted.get(day) ?? 0) + g._count.id);
		}

		const dayOrder: DayOfWeek[] = [
			"MON",
			"TUE",
			"WED",
			"THU",
			"FRI",
			"SAT",
			"SUN",
		];

		return dayOrder.map((day) => {
			const total = dayTotals.get(day) ?? 0;
			const completed = dayCompleted.get(day) ?? 0;
			return {
				day,
				total,
				completed,
				rate: total > 0 ? Math.round((completed / total) * 100) : 0,
			};
		});
	}

	/**
	 * 시간대별 패턴 계산
	 */
	#computeTimePatterns(
		completedTodos: Array<{
			startDate: Date;
			completedAt: Date | null;
		}>,
		timezone: string,
	): TimePatternItem[] {
		const hourCounts = new Map<number, number>();

		for (const todo of completedTodos) {
			if (todo.completedAt) {
				const hour = dayjs(todo.completedAt).tz(timezone).hour();
				hourCounts.set(hour, (hourCounts.get(hour) ?? 0) + 1);
			}
		}

		// 활동이 있는 시간대만 반환
		return Array.from(hourCounts.entries())
			.map(([hour, count]) => ({ hour, count }))
			.sort((a, b) => b.count - a.count);
	}

	/**
	 * 연속 달성일 계산 (endDate부터 역순으로)
	 *
	 * 할 일이 0개인 날은 건너뜁니다 (streak을 끊지 않음).
	 * 예: 주말에 할 일을 안 만들었다면 금-월 연속 달성이 가능합니다.
	 * 할 일이 있었지만 하나라도 미완료라면 streak이 끊깁니다.
	 */
	#computeStreakDays(
		totalGroups: Array<{ startDate: Date; _count: { id: number } }>,
		completedGroups: Array<{ startDate: Date; _count: { id: number } }>,
		startDate: Date,
		endDate: Date,
		timezone: string,
	): number {
		// 날짜별 전체/완료 맵 생성
		const totalByDate = new Map<string, number>();
		const completedByDate = new Map<string, number>();

		for (const g of totalGroups) {
			const dateStr = dayjs(g.startDate).tz(timezone).format("YYYY-MM-DD");
			totalByDate.set(dateStr, (totalByDate.get(dateStr) ?? 0) + g._count.id);
		}
		for (const g of completedGroups) {
			const dateStr = dayjs(g.startDate).tz(timezone).format("YYYY-MM-DD");
			completedByDate.set(
				dateStr,
				(completedByDate.get(dateStr) ?? 0) + g._count.id,
			);
		}

		// endDate 전날부터 역순으로 연속 달성일 계산
		let streak = 0;
		const current = dayjs(endDate).tz(timezone).subtract(1, "day");
		const rangeStart = dayjs(startDate).tz(timezone);

		let cursor = current;
		while (
			cursor.isAfter(rangeStart, "day") ||
			cursor.isSame(rangeStart, "day")
		) {
			const dateStr = cursor.format("YYYY-MM-DD");
			const total = totalByDate.get(dateStr) ?? 0;
			const completed = completedByDate.get(dateStr) ?? 0;

			if (total === 0) {
				// 할 일이 없는 날은 건너뛰기
				cursor = cursor.subtract(1, "day");
				continue;
			}

			if (completed === total) {
				streak++;
				cursor = cursor.subtract(1, "day");
			} else {
				break;
			}
		}

		return streak;
	}
}
