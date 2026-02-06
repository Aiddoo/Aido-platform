import { Injectable } from "@nestjs/common";

import { DatabaseService } from "@/database/database.service";
import type { Prisma, Todo } from "@/generated/prisma/client";

import type {
	FindFriendTodosParams,
	FindTodosParams,
	TodoWithCategory,
	TransactionClient,
} from "./types/todo.types.ts";

/**
 * 날짜 범위 필터 조건 생성 (Overlapping Intervals 패턴)
 *
 * 투두의 기간 [todo.startDate, todo.endDate]가 필터 범위 [filterStart, filterEnd]와 겹치는지 확인합니다.
 *
 * ### 동작 방식
 *
 * **다일(multi-day) 투두** (endDate가 있는 경우):
 * - 두 구간이 겹치려면: todo.startDate <= filterEnd AND todo.endDate >= filterStart
 *
 * **단일 날짜 투두** (endDate가 null인 경우):
 * - todo.startDate가 필터 범위 내에 있어야 함: filterStart <= todo.startDate <= filterEnd
 *
 * ### 단일 날짜 파라미터 처리
 *
 * startDate 또는 endDate 중 하나만 전달되면 해당 날짜를 **exact match**로 처리합니다.
 * (오픈 레인지 방지 — Google Calendar 패턴 준수)
 *
 * ### 사용 시나리오
 *
 * | filterStart | filterEnd | 결과 |
 * |-------------|-----------|------|
 * | 미지정 | 미지정 | undefined (필터 없음) |
 * | 2026-01-15 | 2026-01-15 | 해당 날짜에 해당하는 투두 |
 * | 2026-01-01 | 2026-01-31 | 해당 기간에 걸쳐 있는 투두 |
 * | 2026-01-15 | 미지정 | 해당 날짜에 해당하는 투두 (exact match) |
 * | 미지정 | 2026-01-31 | 해당 날짜에 해당하는 투두 (exact match) |
 */
function buildDateRangeFilter(
	startDate?: Date,
	endDate?: Date,
): Prisma.TodoWhereInput | undefined {
	if (!startDate && !endDate) {
		return undefined;
	}

	// 단일 날짜만 전달 시 → exact match (오픈 레인지 방지)
	const effectiveStart = startDate ?? (endDate as Date);
	const effectiveEnd = endDate ?? (startDate as Date);

	// 다일 투두 (endDate가 있는 경우): Overlapping Intervals
	const multiDayCondition: Prisma.TodoWhereInput = {
		AND: [
			{ endDate: { not: null } },
			{ startDate: { lte: effectiveEnd } },
			{ endDate: { gte: effectiveStart } },
		],
	};

	// 단일 날짜 투두 (endDate가 null인 경우): startDate가 필터 범위 내에 있는지 확인
	const singleDayCondition: Prisma.TodoWhereInput = {
		endDate: null,
		startDate: { gte: effectiveStart, lte: effectiveEnd },
	};

	return { OR: [multiDayCondition, singleDayCondition] };
}

@Injectable()
export class TodoRepository {
	constructor(private readonly database: DatabaseService) {}

	/**
	 * Todo 생성
	 */
	async create(
		data: Prisma.TodoCreateInput,
		tx?: TransactionClient,
	): Promise<TodoWithCategory> {
		const client = tx ?? this.database;
		return client.todo.create({
			data,
			include: {
				category: {
					select: { id: true, name: true, color: true },
				},
			},
		}) as Promise<TodoWithCategory>;
	}

	/**
	 * ID로 Todo 조회
	 */
	async findById(
		id: number,
		tx?: TransactionClient,
	): Promise<TodoWithCategory | null> {
		const client = tx ?? this.database;
		return client.todo.findUnique({
			where: { id },
			include: {
				category: {
					select: { id: true, name: true, color: true },
				},
			},
		}) as Promise<TodoWithCategory | null>;
	}

	/**
	 * 사용자의 Todo 조회 (소유권 확인용)
	 */
	async findByIdAndUserId(
		id: number,
		userId: string,
		tx?: TransactionClient,
	): Promise<TodoWithCategory | null> {
		const client = tx ?? this.database;
		return client.todo.findFirst({
			where: { id, userId },
			include: {
				category: {
					select: { id: true, name: true, color: true },
				},
			},
		}) as Promise<TodoWithCategory | null>;
	}

	/**
	 * 사용자의 Todo 목록 조회 (커서 기반 페이지네이션)
	 */
	async findManyByUserId(
		params: FindTodosParams,
		tx?: TransactionClient,
	): Promise<TodoWithCategory[]> {
		const client = tx ?? this.database;
		const { userId, cursor, size, completed, categoryId, startDate, endDate } =
			params;

		const where: Prisma.TodoWhereInput = {
			userId,
		};

		// 완료 상태 필터
		if (completed !== undefined) {
			where.completed = completed;
		}

		// 카테고리 필터
		if (categoryId !== undefined) {
			where.categoryId = categoryId;
		}

		// 날짜 범위 필터
		const dateFilter = buildDateRangeFilter(startDate, endDate);
		if (dateFilter) {
			where.AND = [dateFilter];
		}

		return client.todo.findMany({
			where,
			take: size + 1, // hasNext 확인을 위해 +1
			...(cursor && {
				skip: 1,
				cursor: { id: cursor },
			}),
			orderBy: [
				{ sortOrder: "asc" },
				{ startDate: "desc" },
				{ createdAt: "desc" },
			],
			include: {
				category: {
					select: { id: true, name: true, color: true },
				},
			},
		}) as Promise<TodoWithCategory[]>;
	}

	/**
	 * Todo 수정
	 */
	async update(
		id: number,
		data: Prisma.TodoUpdateInput,
		tx?: TransactionClient,
	): Promise<TodoWithCategory> {
		const client = tx ?? this.database;
		return client.todo.update({
			where: { id },
			data,
			include: {
				category: {
					select: { id: true, name: true, color: true },
				},
			},
		}) as Promise<TodoWithCategory>;
	}

	/**
	 * Todo 삭제
	 */
	async delete(id: number, tx?: TransactionClient): Promise<Todo> {
		const client = tx ?? this.database;
		return client.todo.delete({
			where: { id },
		});
	}

	/**
	 * 친구의 PUBLIC Todo 목록 조회 (커서 기반 페이지네이션)
	 */
	async findPublicTodosByUserId(
		params: FindFriendTodosParams,
		tx?: TransactionClient,
	): Promise<TodoWithCategory[]> {
		const client = tx ?? this.database;
		const { friendUserId, cursor, size, startDate, endDate } = params;

		const where: Prisma.TodoWhereInput = {
			userId: friendUserId,
			visibility: "PUBLIC",
		};

		// 날짜 범위 필터
		const dateFilter = buildDateRangeFilter(startDate, endDate);
		if (dateFilter) {
			where.AND = [dateFilter];
		}

		return client.todo.findMany({
			where,
			take: size + 1, // hasNext 확인을 위해 +1
			...(cursor && {
				skip: 1,
				cursor: { id: cursor },
			}),
			orderBy: [
				{ sortOrder: "asc" },
				{ startDate: "desc" },
				{ createdAt: "desc" },
			],
			include: {
				category: {
					select: { id: true, name: true, color: true },
				},
			},
		}) as Promise<TodoWithCategory[]>;
	}

	// =========================================================================
	// 알림용 집계 메서드
	// =========================================================================

	/**
	 * 사용자의 오늘 할일 통계 조회
	 * @param userId - 사용자 ID
	 * @param today - 오늘 날짜 (타임존 고려하여 호출부에서 전달)
	 * @returns { total: 전체 할일 수, completed: 완료된 할일 수 }
	 */
	async getTodayTodoStats(
		userId: string,
		today: Date,
		tx?: TransactionClient,
	): Promise<{ total: number; completed: number }> {
		const client = tx ?? this.database;

		// 오늘 날짜에 해당하는 투두 필터
		const dateFilter = buildDateRangeFilter(today, today);
		const where: Prisma.TodoWhereInput = {
			userId,
			...(dateFilter && { AND: [dateFilter] }),
		};

		const [total, completed] = await Promise.all([
			client.todo.count({ where }),
			client.todo.count({ where: { ...where, completed: true } }),
		]);

		return { total, completed };
	}

	/**
	 * 사용자 이름 조회 (알림용)
	 */
	async getUserName(userId: string): Promise<string | null> {
		const user = await this.database.user.findUnique({
			where: { id: userId },
			select: {
				profile: {
					select: { name: true },
				},
			},
		});
		return user?.profile?.name ?? null;
	}

	/**
	 * 사용자의 맞팔 친구 ID 목록 조회 (알림 발송용)
	 *
	 * 최적화: 3단계 중첩 쿼리 대신 Raw SQL JOIN으로 성능 개선
	 */
	async getMutualFriendIds(userId: string): Promise<string[]> {
		// Raw SQL로 최적화된 JOIN 쿼리 (3단계 중첩 쿼리 대신)
		const result = await this.database.$queryRaw<{ followingId: string }[]>`
			SELECT DISTINCT f1."followingId"
			FROM "Follow" f1
			INNER JOIN "Follow" f2
				ON f1."followingId" = f2."followerId"
				AND f2."followingId" = f1."followerId"
			WHERE f1."followerId" = ${userId}
				AND f1."status" = 'ACCEPTED'
				AND f2."status" = 'ACCEPTED'
		`;

		return result.map((r) => r.followingId);
	}

	// =========================================================================
	// Todo 순서 변경
	// =========================================================================

	/**
	 * 사용자의 Todo 최대 sortOrder 조회
	 */
	async getMaxSortOrder(
		userId: string,
		tx?: TransactionClient,
	): Promise<number> {
		const client = tx ?? this.database;
		const result = await client.todo.aggregate({
			where: { userId },
			_max: { sortOrder: true },
		});
		return result._max.sortOrder ?? -1;
	}

	/**
	 * 특정 sortOrder 범위의 Todo들의 sortOrder를 일괄 조정
	 * @param userId - 사용자 ID
	 * @param fromSortOrder - 시작 sortOrder (포함)
	 * @param toSortOrder - 종료 sortOrder (포함), null이면 끝까지
	 * @param delta - 증감값 (+1 또는 -1)
	 */
	async shiftSortOrders(
		userId: string,
		fromSortOrder: number,
		toSortOrder: number | null,
		delta: number,
		tx?: TransactionClient,
	): Promise<number> {
		const client = tx ?? this.database;

		const where: Prisma.TodoWhereInput = {
			userId,
			sortOrder: {
				gte: fromSortOrder,
				...(toSortOrder !== null && { lte: toSortOrder }),
			},
		};

		const result = await client.todo.updateMany({
			where,
			data: {
				sortOrder: { increment: delta },
			},
		});

		return result.count;
	}

	/**
	 * Todo의 sortOrder 업데이트
	 */
	async updateSortOrder(
		id: number,
		sortOrder: number,
		tx?: TransactionClient,
	): Promise<TodoWithCategory> {
		const client = tx ?? this.database;
		return client.todo.update({
			where: { id },
			data: { sortOrder },
			include: {
				category: {
					select: { id: true, name: true, color: true },
				},
			},
		}) as Promise<TodoWithCategory>;
	}
}
