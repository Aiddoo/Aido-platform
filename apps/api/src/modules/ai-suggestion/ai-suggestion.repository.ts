import { DAY_OF_WEEK_ORDER, dayIndexToDayOfWeek } from "@aido/validators";
import { Injectable } from "@nestjs/common";
import dayjs from "dayjs";
import type { TransactionClient } from "@/common/database/prisma.types";
import { now } from "@/common/date/utils/core";
import { toDateString } from "@/common/date/utils/format";
import { DatabaseService } from "@/database/database.service";
import type { Prisma, RecurringSuggestion } from "@/generated/prisma/client";
import type {
	CategoryCompletionRate,
	DayCompletionRate,
	TimeCompletionRate,
	TodoSummaryForAnalysis,
	UserStreakInfo,
} from "./types";

/**
 * AI 반복 제안 리포지토리
 *
 * RecurringSuggestion 데이터의 CRUD 작업을 담당합니다.
 */
@Injectable()
export class AiSuggestionRepository {
	constructor(private readonly database: DatabaseService) {}

	/**
	 * 사용자의 대기 중인 제안 목록 조회
	 *
	 * status=PENDING이고 만료되지 않은 제안을 createdAt 역순으로 반환합니다.
	 */
	async findPendingByUserId(
		userId: string,
		tx?: TransactionClient,
	): Promise<RecurringSuggestion[]> {
		const client = tx ?? this.database;
		return client.recurringSuggestion.findMany({
			where: {
				userId,
				status: "PENDING",
				expiresAt: { gt: now() },
			},
			orderBy: { createdAt: "desc" },
		});
	}

	/**
	 * ID와 사용자 ID로 제안 조회
	 */
	async findByIdAndUserId(
		id: number,
		userId: string,
		tx?: TransactionClient,
	): Promise<RecurringSuggestion | null> {
		const client = tx ?? this.database;
		return client.recurringSuggestion.findFirst({
			where: { id, userId },
		});
	}

	/**
	 * 제안 상태 업데이트
	 */
	async updateStatus(
		id: number,
		status: "PENDING" | "ACCEPTED" | "DISMISSED",
		tx?: TransactionClient,
	): Promise<RecurringSuggestion> {
		const client = tx ?? this.database;
		return client.recurringSuggestion.update({
			where: { id },
			data: { status },
		});
	}

	/**
	 * 제안 생성
	 */
	async create(
		data: Prisma.RecurringSuggestionCreateInput,
		tx?: TransactionClient,
	): Promise<RecurringSuggestion> {
		const client = tx ?? this.database;
		return client.recurringSuggestion.create({ data });
	}

	/**
	 * 제안 일괄 생성
	 */
	async createMany(
		data: Prisma.RecurringSuggestionCreateManyInput[],
		tx?: TransactionClient,
	): Promise<{ count: number }> {
		const client = tx ?? this.database;
		return client.recurringSuggestion.createMany({ data });
	}

	/**
	 * 사용자의 대기 중인(PENDING) 제안 전체 삭제
	 *
	 * 매 분석 시 기존 PENDING 제안을 교체하기 위해 사용합니다.
	 */
	async deletePending(
		userId: string,
		tx?: TransactionClient,
	): Promise<{ count: number }> {
		const client = tx ?? this.database;
		const result = await client.recurringSuggestion.deleteMany({
			where: { userId, status: "PENDING" },
		});
		return { count: result.count };
	}

	/**
	 * 만료된 제안 삭제
	 */
	async deleteExpired(
		userId: string,
		tx?: TransactionClient,
	): Promise<{ count: number }> {
		const client = tx ?? this.database;
		const result = await client.recurringSuggestion.deleteMany({
			where: {
				userId,
				expiresAt: { lt: now() },
			},
		});
		return { count: result.count };
	}

	/**
	 * 요일별 완료율 조회
	 *
	 * DailyCompletion 테이블에서 기간 내 요일별 총 투두/완료 투두를 집계합니다.
	 */
	async findDayCompletionRates(
		userId: string,
		from: Date,
		to: Date,
		timezone: string,
		tx?: TransactionClient,
	): Promise<DayCompletionRate[]> {
		const client = tx ?? this.database;
		const completions = await client.dailyCompletion.findMany({
			where: {
				userId,
				date: { gte: from, lte: to },
			},
			select: { date: true, totalTodos: true, completedTodos: true },
		});

		const dayMap = new Map<string, { total: number; completed: number }>();
		for (const d of DAY_OF_WEEK_ORDER) {
			dayMap.set(d, { total: 0, completed: 0 });
		}

		for (const c of completions) {
			const dayName = dayIndexToDayOfWeek(dayjs(c.date).tz(timezone).day());
			const entry = dayMap.get(dayName);
			if (!entry) continue;
			entry.total += c.totalTodos;
			entry.completed += c.completedTodos;
		}

		return DAY_OF_WEEK_ORDER.map((day) => {
			const entry = dayMap.get(day) ?? { total: 0, completed: 0 };
			return {
				day,
				total: entry.total,
				completed: entry.completed,
			};
		});
	}

	/**
	 * 시간대별 완료율 조회
	 *
	 * completedAt 타임스탬프 기준으로 오전(~12시)/오후(12시~) 완료 건수를 집계합니다.
	 */
	async findTimeCompletionRates(
		userId: string,
		from: Date,
		to: Date,
		timezone: string,
		tx?: TransactionClient,
	): Promise<TimeCompletionRate> {
		const client = tx ?? this.database;
		const todos = await client.todo.findMany({
			where: {
				userId,
				completed: true,
				completedAt: { not: null },
				startDate: { gte: from, lte: to },
			},
			select: { completedAt: true },
		});

		let morning = 0;
		let afternoon = 0;

		for (const t of todos) {
			if (!t.completedAt) continue;
			const hour = dayjs(t.completedAt).tz(timezone).hour();
			if (hour < 12) {
				morning++;
			} else {
				afternoon++;
			}
		}

		const total = morning + afternoon;
		return {
			morning: {
				count: morning,
				rate: total > 0 ? Math.round((morning / total) * 100) : 0,
			},
			afternoon: {
				count: afternoon,
				rate: total > 0 ? Math.round((afternoon / total) * 100) : 0,
			},
		};
	}

	/**
	 * 카테고리별 완료율 조회
	 */
	async findCategoryCompletionRates(
		userId: string,
		from: Date,
		to: Date,
		tx?: TransactionClient,
	): Promise<CategoryCompletionRate[]> {
		const client = tx ?? this.database;
		const todos = await client.todo.findMany({
			where: {
				userId,
				startDate: { gte: from, lte: to },
			},
			select: {
				completed: true,
				category: { select: { name: true } },
			},
		});

		const categoryMap = new Map<string, { total: number; completed: number }>();

		for (const t of todos) {
			const name = t.category.name;
			const entry = categoryMap.get(name) ?? { total: 0, completed: 0 };
			entry.total++;
			if (t.completed) entry.completed++;
			categoryMap.set(name, entry);
		}

		return [...categoryMap.entries()]
			.map(([name, stats]) => ({
				name,
				total: stats.total,
				completed: stats.completed,
				rate:
					stats.total > 0
						? Math.round((stats.completed / stats.total) * 100)
						: 0,
			}))
			.sort((a, b) => b.total - a.total);
	}

	/**
	 * 사용자 스트릭 정보 조회
	 */
	async findUserStreakInfo(
		userId: string,
		tx?: TransactionClient,
	): Promise<UserStreakInfo | null> {
		const client = tx ?? this.database;
		const pref = await client.userPreference.findUnique({
			where: { userId },
			select: { currentStreak: true, longestStreak: true },
		});

		if (!pref) return null;

		return {
			currentStreak: pref.currentStreak,
			longestStreak: pref.longestStreak,
		};
	}

	/**
	 * 최근 할 일 목록 조회 (패턴 분석용)
	 *
	 * 비반복 할 일만 조회하여 패턴 분석에 사용합니다.
	 */
	async findRecentTodos(
		userId: string,
		from: Date,
		to: Date,
		timezone: string,
		tx?: TransactionClient,
	): Promise<TodoSummaryForAnalysis[]> {
		const client = tx ?? this.database;
		const todos = await client.todo.findMany({
			where: {
				userId,
				recurrenceGroupId: null,
				startDate: {
					gte: from,
					lte: to,
				},
			},
			select: {
				title: true,
				startDate: true,
				scheduledTime: true,
				categoryId: true,
				completed: true,
				category: { select: { name: true } },
			},
			orderBy: { startDate: "asc" },
		});

		return todos.map((t) => ({
			title: t.title,
			startDate: toDateString(t.startDate),
			scheduledTime: t.scheduledTime
				? dayjs(t.scheduledTime).tz(timezone).format("HH:mm")
				: null,
			categoryId: t.categoryId,
			completed: t.completed,
			categoryName: t.category.name,
		}));
	}

	/**
	 * 최근 N일 내 수락/거절된 제안 조회
	 *
	 * AI 제안 프롬프트에 사용자 선호 이력을 제공하기 위해 사용합니다.
	 */
	async findRecentResponded(
		userId: string,
		since: Date,
		tx?: TransactionClient,
	): Promise<Pick<RecurringSuggestion, "title" | "status">[]> {
		const client = tx ?? this.database;
		return client.recurringSuggestion.findMany({
			where: {
				userId,
				status: { in: ["ACCEPTED", "DISMISSED"] },
				updatedAt: { gte: since },
			},
			select: { title: true, status: true },
		});
	}
}
