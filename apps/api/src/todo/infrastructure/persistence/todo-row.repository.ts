import { TransactionHost } from "@nestjs-cls/transactional";
import type { TransactionalAdapterPrisma } from "@nestjs-cls/transactional-adapter-prisma";
import { Injectable } from "@nestjs/common";

import type { Prisma, Todo } from "@/generated/prisma/client";
import { now } from "@/shared/domain/date/utils/core";
import type { DatabaseService } from "@/shared/infrastructure/database/database.service";

import type { FindFriendTodosParams, FindTodosParams } from "../../application/types";
import { TODO_CATEGORY_INCLUDE, type TodoItemData, type TodoWithCategory } from "./todo-row.types";

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
function buildDateRangeFilter(startDate?: Date, endDate?: Date): Prisma.TodoWhereInput | undefined {
	if (!startDate && !endDate) {
		return undefined;
	}

	// 단일 날짜만 전달 시 → exact match (오픈 레인지 방지)
	// 가드 통과 후 둘 중 하나는 반드시 존재
	const effectiveStart: Date = startDate ?? endDate ?? now();
	const effectiveEnd: Date = endDate ?? startDate ?? now();

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

/**
 * Todo 행 리포지토리 (row-level DAO)
 *
 * Prisma 행(TodoWithCategory)을 그대로 다루는 저수준 데이터 접근 객체입니다.
 * 도메인 애그리게잇 매핑은 PrismaTodoRepository, 응답 read model 매핑은
 * PrismaTodoReadRepository(+ TodoMapper)가 담당합니다.
 *
 * 트랜잭션은 CLS로 전파됩니다 — TransactionHost.tx가 활성 트랜잭션 클라이언트를,
 * 활성 트랜잭션이 없으면 베이스 DatabaseService를 반환합니다(기존 `tx ?? this.database`와 등가).
 */
@Injectable()
export class TodoRowRepository {
	constructor(
		private readonly txHost: TransactionHost<TransactionalAdapterPrisma<DatabaseService>>,
	) {}

	/** 활성 트랜잭션(없으면 베이스 클라이언트) */
	private get client() {
		return this.txHost.tx;
	}

	/**
	 * Todo 생성
	 */
	async create(data: Prisma.TodoCreateInput): Promise<TodoWithCategory> {
		return this.client.todo.create({
			data,
			include: TODO_CATEGORY_INCLUDE,
		});
	}

	/**
	 * 소유자만 조회 — 목록 캐시 키가 소유자 기준이라 이 한 컬럼이면 충분하다.
	 */
	async findOwner(id: number): Promise<{ userId: string } | null> {
		return this.client.todo.findUnique({
			where: { id },
			select: { userId: true },
		});
	}

	/**
	 * 사용자의 Todo 조회 (소유권 확인용)
	 */
	async findByIdAndUserId(id: number, userId: string): Promise<TodoWithCategory | null> {
		return this.client.todo.findFirst({
			where: { id, userId },
			include: TODO_CATEGORY_INCLUDE,
		});
	}

	/**
	 * 사용자의 Todo 목록 조회 (커서 기반 페이지네이션)
	 */
	async findManyByUserId(params: FindTodosParams): Promise<TodoWithCategory[]> {
		const { userId, cursor, size, completed, categoryId, startDate, endDate } = params;

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

		return this.client.todo.findMany({
			where,
			take: size + 1, // hasNext 확인을 위해 +1
			...(cursor != null && {
				skip: 1,
				cursor: { id: cursor },
			}),
			orderBy: [{ category: { sortOrder: "asc" } }, { sortOrder: "asc" }, { id: "asc" }],
			include: TODO_CATEGORY_INCLUDE,
		});
	}

	/**
	 * Todo 수정
	 */
	async update(id: number, data: Prisma.TodoUpdateInput): Promise<TodoWithCategory> {
		return this.client.todo.update({
			where: { id },
			data,
			include: TODO_CATEGORY_INCLUDE,
		});
	}

	/**
	 * Todo 삭제
	 */
	async delete(id: number): Promise<Todo> {
		return this.client.todo.delete({
			where: { id },
		});
	}

	/**
	 * 친구의 PUBLIC Todo 목록 조회 (커서 기반 페이지네이션)
	 */
	async findPublicTodosByUserId(params: FindFriendTodosParams): Promise<TodoWithCategory[]> {
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

		return this.client.todo.findMany({
			where,
			take: size + 1, // hasNext 확인을 위해 +1
			...(cursor != null && {
				skip: 1,
				cursor: { id: cursor },
			}),
			orderBy: [{ category: { sortOrder: "asc" } }, { sortOrder: "asc" }, { id: "asc" }],
			include: TODO_CATEGORY_INCLUDE,
		});
	}

	/**
	 * 사용자의 완료된 Todo 누적 개수 조회
	 */
	async countCompletedByUser(userId: string): Promise<number> {
		return this.client.todo.count({
			where: { userId, completed: true },
		});
	}

	/**
	 * 특정 카테고리 내 활성(미완료) Todo 개수 조회
	 */
	async countActiveByCategory(userId: string, categoryId: number): Promise<number> {
		return this.client.todo.count({
			where: { userId, categoryId, completed: false },
		});
	}

	/**
	 * 사용자의 오늘 할일 통계 조회
	 * @param userId - 사용자 ID
	 * @param today - 오늘 날짜 (타임존 고려하여 호출부에서 전달)
	 * @returns { total: 전체 할일 수, completed: 완료된 할일 수 }
	 */
	async getTodayTodoStats(
		userId: string,
		today: Date,
	): Promise<{ total: number; completed: number }> {
		// 오늘 날짜에 해당하는 투두 필터
		const dateFilter = buildDateRangeFilter(today, today);
		const where: Prisma.TodoWhereInput = {
			userId,
			...(dateFilter && { AND: [dateFilter] }),
		};

		const [total, completed] = await Promise.all([
			this.client.todo.count({ where }),
			this.client.todo.count({ where: { ...where, completed: true } }),
		]);

		return { total, completed };
	}

	/**
	 * 오늘 할 일 상위 목록 (홈 위젯용) — 미완료 우선, 이후 카테고리/정렬 순.
	 * 위젯에 필요한 컬럼만 select하고 카테고리는 색상만 join한다 (단일 쿼리, N+1 없음).
	 */
	async findTodayTopTodos(
		userId: string,
		today: Date,
		limit: number,
	): Promise<{ id: number; title: string; completed: boolean; categoryColor: string }[]> {
		const dateFilter = buildDateRangeFilter(today, today);
		const where: Prisma.TodoWhereInput = {
			userId,
			...(dateFilter && { AND: [dateFilter] }),
		};

		const rows = await this.client.todo.findMany({
			where,
			take: limit,
			orderBy: [
				{ completed: "asc" }, // 미완료(false) 우선 — 위젯에서 남은 일이 먼저 보이게
				{ category: { sortOrder: "asc" } },
				{ sortOrder: "asc" },
				{ id: "asc" },
			],
			select: {
				id: true,
				title: true,
				completed: true,
				category: { select: { color: true } },
			},
		});

		return rows.map((row) => ({
			id: row.id,
			title: row.title,
			completed: row.completed,
			categoryColor: row.category.color,
		}));
	}

	/**
	 * 사용자의 Todo 최대 sortOrder 조회
	 */
	async getMaxSortOrder(userId: string): Promise<number> {
		const result = await this.client.todo.aggregate({
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
	): Promise<number> {
		const where: Prisma.TodoWhereInput = {
			userId,
			sortOrder: {
				gte: fromSortOrder,
				...(toSortOrder !== null && { lte: toSortOrder }),
			},
		};

		const result = await this.client.todo.updateMany({
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
	async updateSortOrder(id: number, sortOrder: number): Promise<TodoWithCategory> {
		return this.client.todo.update({
			where: { id },
			data: { sortOrder },
			include: TODO_CATEGORY_INCLUDE,
		});
	}

	/**
	 * 트랜잭션 내에서 여러 Todo를 일괄 생성 (createMany + findMany, 2쿼리)
	 *
	 * @description
	 * Prisma의 `createMany`는 `include`를 지원하지 않으므로,
	 * 1) `createMany`로 일괄 INSERT
	 * 2) `findMany`로 생성된 레코드를 category include와 함께 조회
	 *
	 * 기존 순차 N쿼리(`for...of await`) 대비 2쿼리로 대폭 개선.
	 */
	async createManyBatch(
		dataArray: Prisma.TodoCreateManyInput[],
		recurrenceGroupId: string,
	): Promise<TodoWithCategory[]> {
		await this.client.todo.createMany({ data: dataArray });
		return this.client.todo.findMany({
			where: { recurrenceGroupId },
			include: TODO_CATEGORY_INCLUDE,
			orderBy: { sortOrder: "asc" },
		});
	}

	/**
	 * 반복 그룹 전체 조회 (sortOrder asc — createManyBatch 재조회와 동일 정렬)
	 */
	async findManyByRecurrenceGroupId(
		userId: string,
		recurrenceGroupId: string,
	): Promise<TodoWithCategory[]> {
		return this.client.todo.findMany({
			where: { userId, recurrenceGroupId },
			include: TODO_CATEGORY_INCLUDE,
			orderBy: { sortOrder: "asc" },
		});
	}

	// ===== TodoItem CRUD =====

	/**
	 * 인라인 하위 항목 일괄 생성 (createMany, 1쿼리)
	 *
	 * Todo 생성 시 함께 전달된 체크리스트를 배열 순서대로 sortOrder를 부여해 생성합니다.
	 */
	async createManyItems(todoId: number, items: { title: string }[]): Promise<void> {
		await this.client.todoItem.createMany({
			data: items.map((item, index) => ({
				todoId,
				title: item.title,
				sortOrder: index,
			})),
		});
	}

	async createItem(
		todoId: number,
		data: { title: string; sortOrder: number },
	): Promise<TodoItemData> {
		return this.client.todoItem.create({
			data: { todoId, ...data },
			select: {
				id: true,
				title: true,
				completed: true,
				sortOrder: true,
				createdAt: true,
				updatedAt: true,
			},
		});
	}

	async updateItem(itemId: number, data: { title?: string; completed?: boolean }): Promise<void> {
		await this.client.todoItem.update({ where: { id: itemId }, data });
	}

	async deleteItem(itemId: number): Promise<void> {
		await this.client.todoItem.delete({ where: { id: itemId } });
	}

	async reorderItems(itemIds: number[]): Promise<void> {
		await Promise.all(
			itemIds.map((id, index) =>
				this.client.todoItem.update({
					where: { id },
					data: { sortOrder: index },
				}),
			),
		);
	}
}
