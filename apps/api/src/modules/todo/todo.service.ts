import type { Todo } from "@aido/validators";
import { Inject, Injectable, Logger } from "@nestjs/common";
import { EventEmitter2 } from "@nestjs/event-emitter";
import type { TransactionClient } from "@/common/database";
import { getUserToday, now, toDateOnly, toScheduledTime } from "@/common/date";
import {
	EntitlementService,
	Resource,
} from "@/common/entitlement/entitlement.service";
import { BusinessExceptions } from "@/common/exception/services/business-exception.service";
import type { CursorPaginatedResponse } from "@/common/pagination/interfaces/pagination.interface";
import { PaginationService } from "@/common/pagination/services/pagination.service";
import { DatabaseService } from "@/database/database.service";
import { FollowService } from "../follow/follow.service";
import {
	type FriendCompletedEventPayload,
	NotificationEvents,
	type TodoAllCompletedEventPayload,
} from "../notification/events/notification.events";
import {
	type IReminderScheduler,
	REMINDER_SCHEDULER,
} from "../scheduler/reminder";
import { TodoCategoryService } from "../todo-category/todo-category.service";

import { TodoMapper } from "./todo.mapper";
import { TodoRepository } from "./todo.repository";
import type {
	CreateTodoData,
	FindFriendTodosParams,
	FindTodosParams,
	GetFriendTodosParams,
	GetTodosParams,
	UpdateTodoData,
} from "./types/todo.types.ts";

@Injectable()
export class TodoService {
	readonly #logger = new Logger(TodoService.name);

	constructor(
		private readonly todoRepository: TodoRepository,
		private readonly todoCategoryService: TodoCategoryService,
		private readonly paginationService: PaginationService,
		private readonly followService: FollowService,
		private readonly entitlementService: EntitlementService,
		private readonly eventEmitter: EventEmitter2,
		private readonly database: DatabaseService,
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

		if (startDate.getTime() > endDate.getTime()) {
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
		// 리소스 제한 체크
		const [entitlement, activeCount] = await Promise.all([
			this.entitlementService.getResourceLimit(
				data.userId,
				Resource.TODO_ACTIVE,
			),
			this.todoRepository.countActive(data.userId),
		]);
		this.entitlementService.enforceResourceLimit(
			activeCount,
			entitlement.maxCount,
			BusinessExceptions.todoActiveLimitExceeded,
		);

		// 카테고리 존재 및 소유권 확인
		await this.todoCategoryService.validateOwnership(
			data.categoryId,
			data.userId,
		);

		// 새 Todo의 sortOrder 결정 (맨 뒤에 추가)
		const maxSortOrder = await this.todoRepository.getMaxSortOrder(data.userId);
		const newSortOrder = maxSortOrder + 1;

		const todo = await this.todoRepository.create({
			user: { connect: { id: data.userId } },
			category: { connect: { id: data.categoryId } },
			title: data.title,
			content: data.content,
			sortOrder: newSortOrder,
			startDate: data.startDate,
			endDate: data.endDate,
			scheduledTime: data.scheduledTime,
			isAllDay: data.isAllDay ?? true,
			visibility: data.visibility ?? "PUBLIC",
		});

		this.#logger.log(`Todo created: ${todo.id} for user: ${data.userId}`);

		if (todo.scheduledTime) {
			try {
				this.reminderScheduler.scheduleReminder(
					todo.id,
					todo.scheduledTime,
					data.userId,
					todo.title,
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
	 * 활성 Todo 리소스 제한 정보 조회
	 */
	async getResourceLimitInfo(
		userId: string,
	): Promise<{ activeCount: number; maxCount: number | null }> {
		const [entitlement, activeCount] = await Promise.all([
			this.entitlementService.getResourceLimit(userId, Resource.TODO_ACTIVE),
			this.todoRepository.countActive(userId),
		]);
		return { activeCount, maxCount: entitlement.maxCount };
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

	/**
	 * Todo 수정
	 */
	async update(
		id: number,
		userId: string,
		data: UpdateTodoData,
	): Promise<Todo> {
		const todo = await this.todoRepository.findByIdAndUserId(id, userId);

		if (!todo) {
			throw BusinessExceptions.todoNotFound(id);
		}

		// 카테고리 변경 시 소유권 확인
		if (data.categoryId !== undefined) {
			await this.todoCategoryService.validateOwnership(data.categoryId, userId);
		}

		// 완료 상태 변경 시 completedAt 자동 설정
		const updateData: UpdateTodoData & { completedAt?: Date | null } = {
			...data,
		};

		if (data.completed !== undefined) {
			if (data.completed && !todo.completed) {
				// 완료로 변경
				updateData.completedAt = now();
			} else if (!data.completed && todo.completed) {
				// 미완료로 변경
				updateData.completedAt = null;
			}
		}

		const updatedTodo = await this.todoRepository.update(id, updateData);

		if (data.completed) {
			this.reminderScheduler.cancelReminder(id);
		}

		this.#logger.log(`Todo updated: ${id} for user: ${userId}`);

		return TodoMapper.toResponse(updatedTodo);
	}

	/**
	 * Todo 삭제
	 */
	async delete(id: number, userId: string): Promise<void> {
		const todo = await this.todoRepository.findByIdAndUserId(id, userId);

		if (!todo) {
			throw BusinessExceptions.todoNotFound(id);
		}

		await this.todoRepository.delete(id);
		this.reminderScheduler.cancelReminder(id);

		this.#logger.log(`Todo deleted: ${id} for user: ${userId}`);
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
		}

		this.#logger.log(
			`Todo completion toggled: ${id} -> ${data.completed} for user: ${userId}`,
		);

		// 완료로 변경된 경우, 오늘 할일 전체 완료 여부 확인 후 이벤트 발행
		if (data.completed) {
			await this.#checkAndEmitAllCompletedEvent(userId, tz);
		}

		return TodoMapper.toResponse(updatedTodo);
	}

	/**
	 * 오늘 할일 전체 완료 시 이벤트 발행
	 * @private
	 */
	async #checkAndEmitAllCompletedEvent(
		userId: string,
		tz: string = "UTC",
	): Promise<void> {
		try {
			const today = getUserToday(tz);
			const stats = await this.todoRepository.getTodayTodoStats(userId, today);

			// 오늘 할일이 있고, 모두 완료된 경우
			if (stats.total > 0 && stats.total === stats.completed) {
				this.#logger.log(
					`User ${userId} completed all ${stats.completed} todos today!`,
				);

				// 1. 본인에게 전체 완료 이벤트 발행
				this.eventEmitter.emit(NotificationEvents.TODO_ALL_COMPLETED, {
					userId,
					completedCount: stats.completed,
					timezone: tz,
				} satisfies TodoAllCompletedEventPayload);

				// 2. 친구들에게 알림 이벤트 발행
				const [friendIds, userName] = await Promise.all([
					this.followService.getMutualFriendIds(userId),
					this.followService.getUserName(userId),
				]);

				if (friendIds.length > 0) {
					this.eventEmitter.emit(NotificationEvents.FRIEND_COMPLETED, {
						friendId: userId,
						friendName: userName ?? "친구",
						notifyUserIds: friendIds,
						timezone: tz,
					} satisfies FriendCompletedEventPayload);

					this.#logger.log(
						`Friend completed event emitted to ${friendIds.length} friends`,
					);
				}
			}
		} catch (error) {
			// 이벤트 발행 실패가 메인 로직에 영향을 주지 않도록 로깅만 수행
			this.#logger.error(
				`Failed to check/emit all completed event: ${error}`,
				error instanceof Error ? error.stack : undefined,
			);
		}
	}

	/**
	 * Todo 공개 범위 변경
	 */
	async updateVisibility(
		id: number,
		userId: string,
		data: { visibility: "PUBLIC" | "PRIVATE" },
	): Promise<Todo> {
		const todo = await this.todoRepository.findByIdAndUserId(id, userId);

		if (!todo) {
			throw BusinessExceptions.todoNotFound(id);
		}

		const updatedTodo = await this.todoRepository.update(id, {
			visibility: data.visibility,
		});

		this.#logger.log(
			`Todo visibility updated: ${id} -> ${data.visibility} for user: ${userId}`,
		);

		return TodoMapper.toResponse(updatedTodo);
	}

	/**
	 * Todo 색상 변경
	 */
	async updateCategory(
		id: number,
		userId: string,
		data: { categoryId: number },
	): Promise<Todo> {
		const todo = await this.todoRepository.findByIdAndUserId(id, userId);

		if (!todo) {
			throw BusinessExceptions.todoNotFound(id);
		}

		// 새 카테고리 소유권 확인
		await this.todoCategoryService.validateOwnership(data.categoryId, userId);

		const updatedTodo = await this.todoRepository.update(id, {
			category: { connect: { id: data.categoryId } },
		});

		this.#logger.log(
			`Todo category updated: ${id} -> ${data.categoryId} for user: ${userId}`,
		);

		return TodoMapper.toResponse(updatedTodo);
	}

	/**
	 * Todo 일정 변경
	 */
	async updateSchedule(
		id: number,
		userId: string,
		data: {
			startDate: string;
			endDate?: string | null;
			scheduledTime?: string | null;
			isAllDay?: boolean;
		},
		tz: string = "UTC",
	): Promise<Todo> {
		const todo = await this.todoRepository.findByIdAndUserId(id, userId);

		if (!todo) {
			throw BusinessExceptions.todoNotFound(id);
		}

		const updatedTodo = await this.todoRepository.update(id, {
			startDate: toDateOnly(data.startDate),
			endDate: data.endDate ? toDateOnly(data.endDate) : null,
			scheduledTime: data.scheduledTime
				? toScheduledTime(data.startDate, data.scheduledTime, tz)
				: null,
			isAllDay: data.isAllDay ?? true,
		});

		try {
			if (updatedTodo.scheduledTime) {
				this.reminderScheduler.scheduleReminder(
					id,
					updatedTodo.scheduledTime,
					userId,
					updatedTodo.title,
				);
			} else {
				this.reminderScheduler.cancelReminder(id);
			}
		} catch (error) {
			this.#logger.error(
				`Failed to schedule reminder for todo ${id}: ${error}`,
				error instanceof Error ? error.stack : undefined,
			);
		}

		this.#logger.log(`Todo schedule updated: ${id} for user: ${userId}`);

		return TodoMapper.toResponse(updatedTodo);
	}

	/**
	 * Todo 제목/내용 수정
	 */
	async updateContent(
		id: number,
		userId: string,
		data: { title?: string; content?: string | null },
	): Promise<Todo> {
		const todo = await this.todoRepository.findByIdAndUserId(id, userId);

		if (!todo) {
			throw BusinessExceptions.todoNotFound(id);
		}

		const updateData: { title?: string; content?: string | null } = {};

		if (data.title !== undefined) {
			updateData.title = data.title;
		}

		if (data.content !== undefined) {
			updateData.content = data.content;
		}

		const updatedTodo = await this.todoRepository.update(id, updateData);

		this.#logger.log(`Todo content updated: ${id} for user: ${userId}`);

		return TodoMapper.toResponse(updatedTodo);
	}

	/**
	 * Todo 순서 변경 (개별 이동)
	 *
	 * @param id - 이동할 Todo ID
	 * @param userId - 사용자 ID
	 * @param data.targetTodoId - 기준이 되는 Todo ID (없으면 맨 처음/끝으로 이동)
	 * @param data.position - 기준 Todo의 앞('before') 또는 뒤('after')로 이동
	 */
	async reorder(
		id: number,
		userId: string,
		data: { targetTodoId?: number; position: "before" | "after" },
	): Promise<Todo> {
		const { targetTodoId, position } = data;

		return this.database.$transaction(async (tx) => {
			const todo = await this.todoRepository.findByIdAndUserId(id, userId, tx);

			if (!todo) {
				throw BusinessExceptions.todoNotFound(id);
			}

			if (targetTodoId === id) {
				return TodoMapper.toResponse(todo);
			}

			const newSortOrder = targetTodoId
				? await this.#reorderRelativeTo(
						todo.sortOrder,
						targetTodoId,
						position,
						userId,
						tx,
					)
				: await this.#reorderToEdge(todo.sortOrder, position, userId, tx);

			const updatedTodo = await this.todoRepository.updateSortOrder(
				id,
				newSortOrder,
				tx,
			);

			this.#logger.log(
				`Todo reordered: ${id} to sortOrder ${newSortOrder} for user: ${userId}`,
			);

			return TodoMapper.toResponse(updatedTodo);
		});
	}

	async #reorderRelativeTo(
		currentSortOrder: number,
		targetTodoId: number,
		position: "before" | "after",
		userId: string,
		tx: TransactionClient,
	): Promise<number> {
		const targetTodo = await this.todoRepository.findByIdAndUserId(
			targetTodoId,
			userId,
			tx,
		);

		if (!targetTodo) {
			throw BusinessExceptions.todoReorderTargetNotFound(targetTodoId);
		}

		let newSortOrder =
			position === "before" ? targetTodo.sortOrder : targetTodo.sortOrder + 1;

		if (currentSortOrder < newSortOrder) {
			await this.todoRepository.shiftSortOrders(
				userId,
				currentSortOrder + 1,
				newSortOrder - 1,
				-1,
				tx,
			);
			newSortOrder -= 1;
		} else {
			await this.todoRepository.shiftSortOrders(
				userId,
				newSortOrder,
				currentSortOrder - 1,
				1,
				tx,
			);
		}

		return newSortOrder;
	}

	async #reorderToEdge(
		currentSortOrder: number,
		position: "before" | "after",
		userId: string,
		tx: TransactionClient,
	): Promise<number> {
		if (position === "before") {
			await this.todoRepository.shiftSortOrders(
				userId,
				0,
				currentSortOrder - 1,
				1,
				tx,
			);
			return 0;
		}

		const maxSortOrder = await this.todoRepository.getMaxSortOrder(userId, tx);
		await this.todoRepository.shiftSortOrders(
			userId,
			currentSortOrder + 1,
			null,
			-1,
			tx,
		);
		return maxSortOrder;
	}
}
