import { Injectable } from "@nestjs/common";
import type { TransactionClient } from "@/common/database";
import { now } from "@/common/date/utils/core";
import { toDateString } from "@/common/date/utils/format";
import { DatabaseService } from "@/database/database.service";
import type { Prisma, RecurringSuggestion } from "@/generated/prisma/client";
import type { TodoSummaryForAnalysis } from "./types";

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
	 * 사용자의 대기 중인 제안 제목 목록 조회
	 *
	 * 중복 제안 방지를 위해 기존 PENDING 제안의 제목을 Set으로 반환합니다.
	 */
	async findPendingTitles(
		userId: string,
		tx?: TransactionClient,
	): Promise<Set<string>> {
		const client = tx ?? this.database;
		const suggestions = await client.recurringSuggestion.findMany({
			where: {
				userId,
				status: "PENDING",
			},
			select: { title: true },
		});
		return new Set(suggestions.map((s) => s.title));
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
	 * 최근 할 일 목록 조회 (패턴 분석용)
	 *
	 * 비반복 할 일만 조회하여 패턴 분석에 사용합니다.
	 */
	async findRecentTodos(
		userId: string,
		from: Date,
		to: Date,
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
			},
			orderBy: { startDate: "asc" },
		});

		return todos.map((t) => ({
			title: t.title,
			startDate: toDateString(t.startDate),
			scheduledTime: t.scheduledTime
				? `${String(t.scheduledTime.getUTCHours()).padStart(2, "0")}:${String(t.scheduledTime.getUTCMinutes()).padStart(2, "0")}`
				: null,
		}));
	}
}
