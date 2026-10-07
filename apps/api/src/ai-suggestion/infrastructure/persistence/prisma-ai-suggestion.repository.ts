import { DAY_OF_WEEK_ORDER, dayIndexToDayOfWeek } from "@aido/validators";
import { TransactionHost } from "@nestjs-cls/transactional";
import { Injectable } from "@nestjs/common";
import { and } from "@prisma/orm-postgres/orm-client";
import dayjs from "dayjs";

import { now } from "#api/shared/domain/date/utils/core";
import { toDateString } from "#api/shared/domain/date/utils/format";
import {
	decodeRecord,
	encodeCreate,
	encodePatch,
} from "#api/shared/infrastructure/database/database-records";
import {
	databaseDate,
	databaseTimestamp,
} from "#api/shared/infrastructure/database/database-values";
import type * as PrismaModels from "#api/shared/infrastructure/database/database.types";
import { requireRecord } from "#api/shared/infrastructure/database/prisma-error.util";
import type { Prisma8TransactionalAdapter } from "#api/shared/infrastructure/database/prisma8-transactional.adapter";

import type {
	AiSuggestionRepositoryPort,
	CreateSuggestionInput,
} from "../../application/ports/ai-suggestion.repository.port.js";
import { Suggestion, type SuggestionStatus } from "../../domain/entities/suggestion.aggregate.js";
import type {
	CategoryCompletionRate,
	DayCompletionRate,
	SuggestionHistoryItem,
	TimeCompletionRate,
	TodoSummaryForAnalysis,
	UserStreakInfo,
} from "../../domain/types.js";

/**
 * AiSuggestionRepositoryPort의 Prisma 어댑터.
 *
 * RecurringSuggestion의 쓰기·단건 조회는 Suggestion 애그리게잇으로 재구성하고,
 * 분석용 통계 읽기는 도메인 프로젝션으로 반환한다. 트랜잭션은 CLS(TransactionHost.tx)로 전파된다.
 */
@Injectable()
export class PrismaAiSuggestionRepository implements AiSuggestionRepositoryPort {
	constructor(private readonly txHost: TransactionHost<Prisma8TransactionalAdapter>) {}

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
		const rows = decodeRecord(
			"RecurringSuggestion",
			await this.client.orm.public.RecurringSuggestion.where((row) =>
				and(
					row.userId.eq(userId),
					row.status.eq("PENDING"),
					row.expiresAt.gt(databaseTimestamp(now())),
				),
			)
				.orderBy((row) => row.createdAt.desc())
				.all(),
		);
		return rows.map((row) => PrismaAiSuggestionRepository.toEntity(row));
	}

	async findByIdAndUserId(id: number, userId: string): Promise<Suggestion | null> {
		const row = decodeRecord(
			"RecurringSuggestion",
			await this.client.orm.public.RecurringSuggestion.where((row) =>
				and(row.id.eq(id), row.userId.eq(userId)),
			).first(),
		);
		return row ? PrismaAiSuggestionRepository.toEntity(row) : null;
	}

	async updateStatus(id: number, status: SuggestionStatus): Promise<Suggestion> {
		const row = decodeRecord(
			"RecurringSuggestion",
			requireRecord(
				await this.client.orm.public.RecurringSuggestion.where((row) => row.id.eq(id)).update(
					encodePatch("RecurringSuggestion", { status }),
				),
			),
		);
		return PrismaAiSuggestionRepository.toEntity(row);
	}

	async createMany(data: CreateSuggestionInput[]): Promise<{ count: number }> {
		const result = {
			count: await this.client.orm.public.RecurringSuggestion.createAndCount(
				data
					.map((input) => ({
						userId: input.userId,
						title: input.title,
						daysOfWeek: input.daysOfWeek,
						scheduledTime: input.scheduledTime,
						confidence: input.confidence,
						reason: input.reason,
						matchedTodos: input.matchedTodos,
						expiresAt: input.expiresAt,
						suggestedCategoryId: input.suggestedCategoryId,
					}))
					.map((value) => encodeCreate("RecurringSuggestion", value)),
			),
		};
		return { count: result.count };
	}

	async deletePending(userId: string): Promise<{ count: number }> {
		const result = {
			count: await this.client.orm.public.RecurringSuggestion.where((row) =>
				and(row.userId.eq(userId), row.status.eq("PENDING")),
			).deleteAndCount(),
		};
		return { count: result.count };
	}

	async deleteExpired(userId: string): Promise<{ count: number }> {
		const result = {
			count: await this.client.orm.public.RecurringSuggestion.where((row) =>
				and(row.userId.eq(userId), row.expiresAt.lt(databaseTimestamp(now()))),
			).deleteAndCount(),
		};
		return { count: result.count };
	}

	async findDayCompletionRates(
		userId: string,
		from: Date,
		to: Date,
		timezone: string,
	): Promise<DayCompletionRate[]> {
		const completions = decodeRecord(
			"DailyCompletion",
			await this.client.orm.public.DailyCompletion.where((row) =>
				and(
					row.userId.eq(userId),
					row.date.gte(databaseDate(from)),
					row.date.lte(databaseDate(to)),
				),
			)
				.select("date", "totalTodos", "completedTodos")
				.all(),
		);

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
		const todos = decodeRecord(
			"Todo",
			await this.client.orm.public.Todo.where((row) =>
				and(
					row.userId.eq(userId),
					row.completed.eq(true),
					row.completedAt.isNotNull(),
					row.startDate.gte(databaseDate(from)),
					row.startDate.lte(databaseDate(to)),
				),
			)
				.select("completedAt")
				.all(),
		);

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
		const todos = decodeRecord(
			"Todo",
			await this.client.orm.public.Todo.where((row) =>
				and(
					row.userId.eq(userId),
					row.startDate.gte(databaseDate(from)),
					row.startDate.lte(databaseDate(to)),
				),
			)
				.select("completed")
				.include("category", (related) => related.select("name"))
				.all(),
		);

		const categoryMap = new Map<string, { total: number; completed: number }>();

		for (const t of todos) {
			const name = requireRecord(t.category).name;
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
		const pref = decodeRecord(
			"UserPreference",
			await this.client.orm.public.UserPreference.where((row) => row.userId.eq(userId))
				.select("currentStreak", "longestStreak")
				.first(),
		);

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
		const todos = decodeRecord(
			"Todo",
			await this.client.orm.public.Todo.where((row) =>
				and(
					row.userId.eq(userId),
					row.recurrenceGroupId.isNull(),
					row.startDate.gte(databaseDate(from)),
					row.startDate.lte(databaseDate(to)),
				),
			)
				.select("title", "startDate", "scheduledTime", "categoryId", "completed")
				.include("category", (related) => related.select("name"))
				.orderBy((row) => row.startDate.asc())
				.all(),
		);

		return todos.map((t) => ({
			title: t.title,
			startDate: toDateString(t.startDate),
			scheduledTime: t.scheduledTime ? dayjs(t.scheduledTime).tz(timezone).format("HH:mm") : null,
			categoryId: t.categoryId,
			completed: t.completed,
			categoryName: requireRecord(t.category).name,
		}));
	}

	async findRecentResponded(userId: string, since: Date): Promise<SuggestionHistoryItem[]> {
		const rows = decodeRecord(
			"RecurringSuggestion",
			await this.client.orm.public.RecurringSuggestion.where((row) =>
				and(
					row.userId.eq(userId),
					row.status.in(["ACCEPTED", "DISMISSED"]),
					row.updatedAt.gte(databaseTimestamp(since)),
				),
			)
				.select("title", "status")
				.all(),
		);

		return rows.map((row) => ({
			title: row.title,
			status: row.status === "ACCEPTED" ? "ACCEPTED" : "DISMISSED",
		}));
	}
}
