import { randomUUID } from "node:crypto";
import {
	DAY_OF_WEEK_MAP,
	type DayOfWeek,
	RECURRING_TODO_LIMITS,
	TODO_ITEM_LIMITS,
	TODO_LIMITS,
	type Todo,
} from "@aido/validators";
import { Inject, Injectable, Logger } from "@nestjs/common";
import dayjs from "dayjs";
import { CacheService } from "@/common/cache/cache.service";
import { isAfter } from "@/common/date/utils/compare";
import { now } from "@/common/date/utils/core";
import { parseDateOnly } from "@/common/date/utils/parse";
import {
	parseLocalDateTime,
	todayInTimezone,
} from "@/common/date/utils/timezone";
import { BusinessExceptions } from "@/common/exception/services/business-exception.service";
import type { CursorPaginatedResponse } from "@/common/pagination";
import { PaginationService } from "@/common/pagination";
import { DatabaseService } from "@/database/database.service";
import type { Prisma } from "@/generated/prisma/client";
import { FollowService } from "../follow/follow.service";
import type { MilestoneReachedJobData } from "../notification/queue/notification-queue.constants";

/** 누적 완료 카운트 → 마일스톤 매핑 */
const COMPLETION_MILESTONES: ReadonlyMap<
	number,
	MilestoneReachedJobData["milestone"]
> = new Map([
	[1, "FIRST_COMPLETE"],
	[10, "COUNT_10"],
	[50, "COUNT_50"],
	[100, "COUNT_100"],
]);

import { NotificationQueueService } from "../notification/queue/notification-queue.service";
import {
	type IReminderScheduler,
	REMINDER_SCHEDULER,
} from "../scheduler/reminder";
import { TodoCategoryService } from "../todo-category/todo-category.service";

import { StreakService } from "../user-settings/services/streak.service";
import { TodoMapper } from "./todo.mapper";
import { TodoRepository } from "./todo.repository";
import type {
	CreateRecurringTodoData,
	CreateTodoData,
	FindFriendTodosParams,
	FindTodosParams,
	GetFriendTodosParams,
	GetTodosParams,
} from "./types/todo.types.ts";

@Injectable()
export class TodoService {
	readonly #logger = new Logger(TodoService.name);

	constructor(
		private readonly todoRepository: TodoRepository,
		private readonly todoCategoryService: TodoCategoryService,
		private readonly paginationService: PaginationService,
		private readonly followService: FollowService,
		private readonly notificationQueueService: NotificationQueueService,
		private readonly database: DatabaseService,
		private readonly cacheService: CacheService,
		private readonly streakService: StreakService,
		@Inject(REMINDER_SCHEDULER)
		private readonly reminderScheduler: IReminderScheduler,
	) {}

	/**
	 * 날짜 범위 파라미터 검증
	 * startDate와 endDate가 모두 존재할 때 startDate <= endDate 여야 합니다.
	 */
	#validateDateRange(startDate?: Date, endDate?: Date): void {
		if (!startDate || !endDate) {
			return;
		}

		if (isAfter(startDate, endDate)) {
			throw BusinessExceptions.invalidParameter({
				message: "startDate must be less than or equal to endDate",
				startDate,
				endDate,
			});
		}
	}

	/**
	 * Todo 생성
	 */
	async create(data: CreateTodoData): Promise<Todo> {
		// 카테고리 존재 및 소유권 확인 (읽기 전용, TX 외부)
		await this.todoCategoryService.validateOwnership(
			data.categoryId,
			data.userId,
		);

		// TX 내에서 제한 체크 + sortOrder 결정 + 생성 (race condition 방지)
		const todo = await this.database.$transaction(async (tx) => {
			const activeInCategory = await this.todoRepository.countActiveByCategory(
				data.userId,
				data.categoryId,
				tx,
			);
			if (activeInCategory >= TODO_LIMITS.MAX_PER_CATEGORY) {
				throw BusinessExceptions.todoCategoryFull(
					activeInCategory,
					TODO_LIMITS.MAX_PER_CATEGORY,
				);
			}

			const maxSortOrder = await this.todoRepository.getMaxSortOrder(
				data.userId,
				tx,
			);

			const created = await this.todoRepository.create(
				{
					user: { connect: { id: data.userId } },
					category: { connect: { id: data.categoryId } },
					title: data.title,
					sortOrder: maxSortOrder + 1,
					startDate: data.startDate,
					endDate: data.endDate,
					scheduledTime: data.scheduledTime,
					isAllDay: data.isAllDay ?? true,
					visibility: data.visibility ?? "PUBLIC",
				},
				tx,
			);

			// 인라인 하위 항목 생성 (createMany로 1회 쿼리)
			if (data.items?.length) {
				await tx.todoItem.createMany({
					data: data.items.map((item, i) => ({
						todoId: created.id,
						title: item.title,
						sortOrder: i,
					})),
				});
				// items 포함하여 재조회
				const refetched = await this.todoRepository.findByIdAndUserId(
					created.id,
					data.userId,
					tx,
				);
				if (!refetched) {
					throw BusinessExceptions.todoNotFound(created.id);
				}
				return refetched;
			}

			return created;
		});

		this.#logger.log(`Todo created: ${todo.id} for user: ${data.userId}`);

		await this.cacheService.invalidateTodoCategories(data.userId);

		if (todo.scheduledTime) {
			try {
				this.reminderScheduler.scheduleReminder(
					todo.id,
					todo.scheduledTime,
					data.userId,
				);
			} catch (error) {
				this.#logger.error(
					`Failed to schedule reminder for todo ${todo.id}: ${error}`,
					error instanceof Error ? error.stack : undefined,
				);
			}
		}

		return TodoMapper.toResponse(todo);
	}

	/**
	 * 카테고리당 활성 Todo 리소스 제한 정보 조회
	 */
	async getResourceLimitInfo(
		userId: string,
		categoryId?: number,
	): Promise<{ activeCount?: number; maxPerCategory: number }> {
		if (categoryId) {
			const activeCount = await this.todoRepository.countActiveByCategory(
				userId,
				categoryId,
			);
			return { activeCount, maxPerCategory: TODO_LIMITS.MAX_PER_CATEGORY };
		}
		return { maxPerCategory: TODO_LIMITS.MAX_PER_CATEGORY };
	}

	/**
	 * 단일 Todo 조회
	 */
	async findById(id: number, userId: string): Promise<Todo> {
		const todo = await this.todoRepository.findByIdAndUserId(id, userId);

		if (!todo) {
			throw BusinessExceptions.todoNotFound(id);
		}

		this.#logger.debug(`Todo retrieved: ${id} for user: ${userId}`);

		return TodoMapper.toResponse(todo);
	}

	/**
	 * Todo 목록 조회 (커서 기반 페이지네이션)
	 */
	async findMany(
		params: GetTodosParams,
	): Promise<CursorPaginatedResponse<Todo, number>> {
		this.#validateDateRange(params.startDate, params.endDate);

		const { cursor, size } =
			this.paginationService.normalizeCursorPagination<number>({
				cursor: params.cursor,
				size: params.size,
			});

		const repoParams: FindTodosParams = {
			userId: params.userId,
			cursor,
			size,
			completed: params.completed,
			categoryId: params.categoryId,
			startDate: params.startDate,
			endDate: params.endDate,
		};

		const todos = await this.todoRepository.findManyByUserId(repoParams);

		this.#logger.debug(
			`Todos listed: ${todos.length} items for user: ${params.userId}`,
		);

		return this.paginationService.createCursorPaginatedResponse<Todo, number>({
			items: TodoMapper.toManyResponse(todos),
			size,
		});
	}

	/**
	 * 친구의 PUBLIC Todo 목록 조회
	 *
	 * 1. 맞팔 관계 확인
	 * 2. 친구의 PUBLIC 투두만 조회
	 */
	async findFriendTodos(
		params: GetFriendTodosParams,
	): Promise<CursorPaginatedResponse<Todo, number>> {
		const { userId, friendUserId } = params;
		this.#validateDateRange(params.startDate, params.endDate);

		// 1. 맞팔 관계 확인
		const isMutualFriend = await this.followService.isMutualFriend(
			userId,
			friendUserId,
		);

		if (!isMutualFriend) {
			throw BusinessExceptions.notFriendsCannotViewTodos(friendUserId);
		}

		// 2. 페이지네이션 정규화
		const { cursor, size } =
			this.paginationService.normalizeCursorPagination<number>({
				cursor: params.cursor,
				size: params.size,
			});

		// 3. 친구의 PUBLIC 투두 조회
		const repoParams: FindFriendTodosParams = {
			friendUserId,
			cursor,
			size,
			startDate: params.startDate,
			endDate: params.endDate,
		};

		const todos = await this.todoRepository.findPublicTodosByUserId(repoParams);

		this.#logger.debug(
			`Friend todos listed: ${todos.length} items for friend: ${friendUserId} by user: ${userId}`,
		);

		return this.paginationService.createCursorPaginatedResponse<Todo, number>({
			items: TodoMapper.toManyResponse(todos),
			size,
		});
	}

	// ===== 액션별 수정 메서드 (SRP) =====

	/**
	 * Todo 완료 상태 토글
	 */
	async toggleComplete(
		id: number,
		userId: string,
		data: { completed: boolean },
		tz: string = "UTC",
	): Promise<Todo> {
		const todo = await this.todoRepository.findByIdAndUserId(id, userId);

		if (!todo) {
			throw BusinessExceptions.todoNotFound(id);
		}

		const updateData = {
			completed: data.completed,
			completedAt: data.completed ? now() : null,
		};

		const updatedTodo = await this.todoRepository.update(id, updateData);

		if (data.completed) {
			this.reminderScheduler.cancelReminder(id);
			this.#checkAndEnqueueFriendCompletedEvent(userId, tz);
			this.#checkAndEnqueueMilestoneEvent(userId);
		}

		// fire-and-forget 스트릭 갱신
		this.streakService.onTodoToggled(userId, data.completed, tz);

		this.#logger.log(
			`Todo completion toggled: ${id} -> ${data.completed} for user: ${userId}`,
		);

		return TodoMapper.toResponse(updatedTodo);
	}

	/**
	 * 오늘 할일 전체 완료 시 친구들에게 알림 큐에 등록
	 *
	 * 본인 축하 알림은 저녁 리마인더(EVENING_COMPLETE)에서 처리합니다.
	 * @private
	 */
	async #checkAndEnqueueFriendCompletedEvent(
		userId: string,
		tz: string = "UTC",
	): Promise<void> {
		try {
			const today = todayInTimezone(tz);
			const stats = await this.todoRepository.getTodayTodoStats(userId, today);

			if (stats.total > 0 && stats.total === stats.completed) {
				const [friendIds, userName] = await Promise.all([
					this.followService.getMutualFriendIds(userId),
					this.followService.getUserDisplayName(userId),
				]);

				if (friendIds.length > 0) {
					this.notificationQueueService.enqueueFriendCompleted({
						friendId: userId,
						friendName: userName,
						notifyUserIds: friendIds,
						timezone: tz,
					});

					this.#logger.log(
						`Friend completed event enqueued for ${friendIds.length} friends`,
					);
				}
			}
		} catch (error) {
			this.#logger.error(
				`Failed to check/enqueue friend completed event: ${error}`,
				error instanceof Error ? error.stack : undefined,
			);
		}
	}

	/**
	 * 마일스톤 달성 여부 체크 및 알림 큐 등록 (fire-and-forget)
	 * @private
	 */
	#checkAndEnqueueMilestoneEvent(userId: string): void {
		this.#checkMilestoneAsync(userId).catch((error) => {
			this.#logger.error(
				`Failed to check milestone event: userId=${userId}, ${error}`,
				error instanceof Error ? error.stack : undefined,
			);
		});
	}

	async #checkMilestoneAsync(userId: string): Promise<void> {
		const count = await this.todoRepository.countCompletedByUser(userId);
		const milestone = COMPLETION_MILESTONES.get(count);
		if (!milestone) return;
		this.notificationQueueService.enqueueMilestoneReached({
			userId,
			milestone,
		});
	}

	// ===== 반복 Todo 생성 =====

	/**
	 * 반복 Todo 생성
	 *
	 * 날짜 범위와 요일 조합에 따라 여러 개의 독립적인 Todo를 일괄 생성합니다.
	 * 각 Todo는 해당 날짜에 대한 독립적인 완료 상태를 가집니다.
	 */
	async createRecurring(
		data: CreateRecurringTodoData,
		tz: string = "UTC",
	): Promise<{ todos: Todo[]; count: number }> {
		// 1. 날짜 확장 (요일 매칭)
		const matchingDates = this.#expandRecurringDates(
			data.startDate,
			data.endDate,
			data.daysOfWeek,
		);
		const todoCount = matchingDates.length;

		// 2. 인스턴스 수 검증
		if (todoCount === 0) {
			throw BusinessExceptions.invalidParameter({
				message: "선택한 기간과 요일에 해당하는 날짜가 없습니다",
				startDate: data.startDate,
				endDate: data.endDate,
				daysOfWeek: data.daysOfWeek,
			});
		}

		if (todoCount > RECURRING_TODO_LIMITS.MAX_INSTANCES) {
			throw BusinessExceptions.recurringTodoInstanceLimitExceeded(
				todoCount,
				RECURRING_TODO_LIMITS.MAX_INSTANCES,
			);
		}

		// 3. 카테고리 소유권 확인 (읽기 전용, TX 외부)
		await this.todoCategoryService.validateOwnership(
			data.categoryId,
			data.userId,
		);

		// 4. TX 내에서 제한 체크 + 일괄 생성 (race condition 방지)
		const recurrenceGroupId = randomUUID();

		const todos = await this.database.$transaction(async (tx) => {
			// 카테고리당 활성 투두 제한 체크
			const activeInCategory = await this.todoRepository.countActiveByCategory(
				data.userId,
				data.categoryId,
				tx,
			);

			if (activeInCategory + todoCount > TODO_LIMITS.MAX_PER_CATEGORY) {
				throw BusinessExceptions.recurringTodoWouldExceedCategoryLimit(
					activeInCategory,
					todoCount,
					TODO_LIMITS.MAX_PER_CATEGORY,
				);
			}

			const maxSortOrder = await this.todoRepository.getMaxSortOrder(
				data.userId,
				tx,
			);

			// flat 포맷 (createMany용 — TodoCreateManyInput)
			const createInputs: Prisma.TodoCreateManyInput[] = matchingDates.map(
				(dateStr, index) => ({
					userId: data.userId,
					categoryId: data.categoryId,
					title: data.title,
					sortOrder: maxSortOrder + 1 + index,
					startDate: parseDateOnly(dateStr),
					scheduledTime: data.scheduledTime
						? parseLocalDateTime(dateStr, data.scheduledTime, tz)
						: null,
					isAllDay: data.isAllDay ?? true,
					visibility: data.visibility ?? "PUBLIC",
					recurrenceGroupId,
				}),
			);

			return this.todoRepository.createManyBatch(
				createInputs,
				recurrenceGroupId,
				tx,
			);
		});

		this.#logger.log(
			`Recurring todos created: ${todoCount} items, group: ${recurrenceGroupId}, user: ${data.userId}`,
		);

		// 6. 리마인더 스케줄링 (트랜잭션 외부)
		for (const todo of todos) {
			if (todo.scheduledTime) {
				try {
					this.reminderScheduler.scheduleReminder(
						todo.id,
						todo.scheduledTime,
						data.userId,
					);
				} catch (error) {
					this.#logger.error(
						`Failed to schedule reminder for recurring todo ${todo.id}: ${error}`,
						error instanceof Error ? error.stack : undefined,
					);
				}
			}
		}

		return {
			todos: TodoMapper.toManyResponse(todos),
			count: todoCount,
		};
	}

	/**
	 * 날짜 범위와 요일 목록으로 매칭되는 날짜 배열을 생성합니다.
	 */
	#expandRecurringDates(
		startDate: string,
		endDate: string,
		daysOfWeek: DayOfWeek[],
	): string[] {
		const targetDays = new Set(daysOfWeek.map((d) => DAY_OF_WEEK_MAP[d]));
		const dates: string[] = [];
		let current = dayjs.utc(startDate);
		const end = dayjs.utc(endDate);

		while (current.isBefore(end) || current.isSame(end, "day")) {
			if (targetDays.has(current.day())) {
				dates.push(current.format("YYYY-MM-DD"));
			}
			current = current.add(1, "day");
		}

		return dates;
	}

	// ===== 하위 항목 (체크리스트) 관리 =====

	/**
	 * 하위 항목 추가
	 *
	 * 제한 체크 + 생성을 $transaction 내에서 수행 (race condition 방지)
	 */
	async addItem(
		todoId: number,
		userId: string,
		data: { title: string },
	): Promise<Todo> {
		// 소유권 확인 (읽기 전용, TX 외부)
		const todo = await this.todoRepository.findByIdAndUserId(todoId, userId);
		if (!todo) {
			throw BusinessExceptions.todoNotFound(todoId);
		}

		// TX 내에서 제한 체크 + sortOrder 결정 + 생성 (race condition 방지)
		const updatedTodo = await this.database.$transaction(async (tx) => {
			const itemCount = await this.todoRepository.countItemsByTodoId(
				todoId,
				tx,
			);
			if (itemCount >= TODO_ITEM_LIMITS.MAX_PER_TODO) {
				throw BusinessExceptions.todoItemLimitExceeded(
					itemCount,
					TODO_ITEM_LIMITS.MAX_PER_TODO,
				);
			}

			const maxSortOrder = await this.todoRepository.getMaxItemSortOrder(
				todoId,
				tx,
			);
			await this.todoRepository.createItem(
				todoId,
				{
					title: data.title,
					sortOrder: maxSortOrder + 1,
				},
				tx,
			);

			const updatedTodo = await this.todoRepository.findByIdAndUserId(
				todoId,
				userId,
				tx,
			);
			if (!updatedTodo) {
				throw BusinessExceptions.todoNotFound(todoId);
			}
			return updatedTodo;
		});

		return TodoMapper.toResponse(updatedTodo);
	}

	/**
	 * 하위 항목 수정 (제목/완료 토글)
	 *
	 * 소유권 확인 + 수정 + 재조회를 TX 내에서 원자적으로 수행
	 */
	async updateItem(
		todoId: number,
		itemId: number,
		userId: string,
		data: { title?: string; completed?: boolean },
	): Promise<Todo> {
		return this.database.$transaction(async (tx) => {
			const todo = await this.todoRepository.findByIdAndUserId(
				todoId,
				userId,
				tx,
			);
			if (!todo) {
				throw BusinessExceptions.todoNotFound(todoId);
			}

			const item = todo.items.find((i) => i.id === itemId);
			if (!item) {
				throw BusinessExceptions.todoItemNotFound(itemId);
			}

			await this.todoRepository.updateItem(itemId, data, tx);

			const updatedTodo = await this.todoRepository.findByIdAndUserId(
				todoId,
				userId,
				tx,
			);
			if (!updatedTodo) {
				throw BusinessExceptions.todoNotFound(todoId);
			}
			return TodoMapper.toResponse(updatedTodo);
		});
	}

	/**
	 * 하위 항목 삭제
	 *
	 * 소유권 확인 + 삭제 + 재조회를 TX 내에서 원자적으로 수행
	 */
	async deleteItem(
		todoId: number,
		itemId: number,
		userId: string,
	): Promise<Todo> {
		return this.database.$transaction(async (tx) => {
			const todo = await this.todoRepository.findByIdAndUserId(
				todoId,
				userId,
				tx,
			);
			if (!todo) {
				throw BusinessExceptions.todoNotFound(todoId);
			}

			const item = todo.items.find((i) => i.id === itemId);
			if (!item) {
				throw BusinessExceptions.todoItemNotFound(itemId);
			}

			await this.todoRepository.deleteItem(itemId, tx);

			const updatedTodo = await this.todoRepository.findByIdAndUserId(
				todoId,
				userId,
				tx,
			);
			if (!updatedTodo) {
				throw BusinessExceptions.todoNotFound(todoId);
			}
			return TodoMapper.toResponse(updatedTodo);
		});
	}

	/**
	 * 하위 항목 순서 변경
	 *
	 * 기존 Todo reorder 패턴과 동일: 소유권 확인 + 검증 + 다중 쓰기를 TX 내부에서 수행
	 */
	async reorderItems(
		todoId: number,
		userId: string,
		data: { itemIds: number[] },
	): Promise<Todo> {
		return this.database.$transaction(async (tx) => {
			const todo = await this.todoRepository.findByIdAndUserId(
				todoId,
				userId,
				tx,
			);
			if (!todo) {
				throw BusinessExceptions.todoNotFound(todoId);
			}

			// 전체 항목 ID 필수 검증 (부분 전달 시 sortOrder 충돌 방지)
			const todoItemIds = new Set(todo.items.map((i) => i.id));
			if (data.itemIds.length !== todoItemIds.size) {
				throw BusinessExceptions.invalidParameter({
					message: "모든 하위 항목 ID를 전달해야 합니다",
					expected: todoItemIds.size,
					received: data.itemIds.length,
				});
			}
			for (const id of data.itemIds) {
				if (!todoItemIds.has(id)) {
					throw BusinessExceptions.todoItemNotFound(id);
				}
			}

			await this.todoRepository.reorderItems(data.itemIds, tx);

			const updatedTodo = await this.todoRepository.findByIdAndUserId(
				todoId,
				userId,
				tx,
			);
			if (!updatedTodo) {
				throw BusinessExceptions.todoNotFound(todoId);
			}
			return TodoMapper.toResponse(updatedTodo);
		});
	}
}
