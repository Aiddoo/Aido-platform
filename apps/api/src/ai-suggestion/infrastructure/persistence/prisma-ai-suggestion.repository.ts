import { DAY_OF_WEEK_ORDER, dayIndexToDayOfWeek } from "@aido/validators";
import { TransactionHost } from "@nestjs-cls/transactional";
import type { TransactionalAdapterPrisma } from "@nestjs-cls/transactional-adapter-prisma";
import { Injectable } from "@nestjs/common";
import dayjs from "dayjs";

import type * as PrismaModels from "@/generated/prisma/client";
import { now } from "@/shared/domain/date/utils/core";
import { toDateString } from "@/shared/domain/date/utils/format";
import type { DatabaseService } from "@/shared/infrastructure/database/database.service";

import type {
	AiSuggestionRepositoryPort,
	CreateSuggestionInput,
} from "../../application/ports/ai-suggestion.repository.port";
import { Suggestion, type SuggestionStatus } from "../../domain/entities/suggestion.aggregate";
import type {
	CategoryCompletionRate,
	DayCompletionRate,
	SuggestionHistoryItem,
	TimeCompletionRate,
	TodoSummaryForAnalysis,
	UserStreakInfo,
} from "../../domain/types";

/**
 * AiSuggestionRepositoryPort의 Prisma 어댑터.
 *
 * RecurringSuggestion의 쓰기·단건 조회는 Suggestion 애그리게잇으로 재구성하고,
 * 분석용 통계 읽기는 도메인 프로젝션으로 반환한다. 트랜잭션은 CLS(TransactionHost.tx)로 전파된다.
 */
@Injectable()
export class PrismaAiSuggestionRepository implements AiSuggestionRepositoryPort {
	constructor(
		private readonly txHost: TransactionHost<TransactionalAdapterPrisma<DatabaseService>>,
	) {}

	/** 활성 트랜잭션(없으면 베이스 클라이언트) */
	private get client() {
		return this.txHost.tx;
	}

	private static toEntity(row: PrismaModels.RecurringSuggestion): Suggestion {
		return Suggestion.reconstitute({
			id: row.id,
			userId: row.userId,
			title: row.title,
			daysOfWeek: row.daysOfWeek,
			scheduledTime: row.scheduledTime,
			confidence: row.confidence,
			reason: row.reason,
			matchedTodos: row.matchedTodos,
			suggestedCategoryId: row.suggestedCategoryId,
			status: row.status,
			expiresAt: row.expiresAt,
			createdAt: row.createdAt,
			updatedAt: row.updatedAt,
		});
	}

	async findPendingByUserId(userId: string): Promise<Suggestion[]> {
		const rows = await this.client.recurringSuggestion.findMany({
			where: {
				userId,
				status: "PENDING",
				expiresAt: { gt: now() },
			},
			orderBy: { createdAt: "desc" },
		});
		return rows.map((row) => PrismaAiSuggestionRepository.toEntity(row));
	}

	async findByIdAndUserId(id: number, userId: string): Promise<Suggestion | null> {
		const row = await this.client.recurringSuggestion.findFirst({
			where: { id, userId },
		});
		return row ? PrismaAiSuggestionRepository.toEntity(row) : null;
	}

	async updateStatus(id: number, status: SuggestionStatus): Promise<Suggestion> {
		const row = await this.client.recurringSuggestion.update({
			where: { id },
			data: { status },
		});
		return PrismaAiSuggestionRepository.toEntity(row);
	}

	async createMany(data: CreateSuggestionInput[]): Promise<{ count: number }> {
		const result = await this.client.recurringSuggestion.createMany({
			data: data.map((input) => ({
				userId: input.userId,
				title: input.title,
				daysOfWeek: input.daysOfWeek,
				scheduledTime: input.scheduledTime,
				confidence: input.confidence,
				reason: input.reason,
				matchedTodos: input.matchedTodos,
				expiresAt: input.expiresAt,
				suggestedCategoryId: input.suggestedCategoryId,
			})),
		});
		return { count: result.count };
	}

	async deletePending(userId: string): Promise<{ count: number }> {
		const result = await this.client.recurringSuggestion.deleteMany({
			where: { userId, status: "PENDING" },
		});
		return { count: result.count };
	}

	async deleteExpired(userId: string): Promise<{ count: number }> {
		const result = await this.client.recurringSuggestion.deleteMany({
			where: {
				userId,
				expiresAt: { lt: now() },
			},
		});
		return { count: result.count };
	}

	async findDayCompletionRates(
		userId: string,
		from: Date,
		to: Date,
		timezone: string,
	): Promise<DayCompletionRate[]> {
		const completions = await this.client.dailyCompletion.findMany({
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

	async findTimeCompletionRates(
		userId: string,
		from: Date,
		to: Date,
		timezone: string,
	): Promise<TimeCompletionRate> {
		const todos = await this.client.todo.findMany({
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

	async findCategoryCompletionRates(
		userId: string,
		from: Date,
		to: Date,
	): Promise<CategoryCompletionRate[]> {
		const todos = await this.client.todo.findMany({
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
				rate: stats.total > 0 ? Math.round((stats.completed / stats.total) * 100) : 0,
			}))
			.sort((a, b) => b.total - a.total);
	}

	async findUserStreakInfo(userId: string): Promise<UserStreakInfo | null> {
		const pref = await this.client.userPreference.findUnique({
			where: { userId },
			select: { currentStreak: true, longestStreak: true },
		});

		if (!pref) return null;

		return {
			currentStreak: pref.currentStreak,
			longestStreak: pref.longestStreak,
		};
	}

	async findRecentTodos(
		userId: string,
		from: Date,
		to: Date,
		timezone: string,
	): Promise<TodoSummaryForAnalysis[]> {
		const todos = await this.client.todo.findMany({
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
			scheduledTime: t.scheduledTime ? dayjs(t.scheduledTime).tz(timezone).format("HH:mm") : null,
			categoryId: t.categoryId,
			completed: t.completed,
			categoryName: t.category.name,
		}));
	}

	async findRecentResponded(userId: string, since: Date): Promise<SuggestionHistoryItem[]> {
		const rows = await this.client.recurringSuggestion.findMany({
			where: {
				userId,
				status: { in: ["ACCEPTED", "DISMISSED"] },
				updatedAt: { gte: since },
			},
			select: { title: true, status: true },
		});

		return rows.map((row) => ({
			title: row.title,
			status: row.status === "ACCEPTED" ? "ACCEPTED" : "DISMISSED",
		}));
	}
}
