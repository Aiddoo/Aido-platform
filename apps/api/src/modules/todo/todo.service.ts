import type { Todo } from "@aido/validators";
import { Injectable, Logger } from "@nestjs/common";
import { EventEmitter2 } from "@nestjs/event-emitter";
import { now, toDate } from "@/common/date";
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
import { TodoCategoryRepository } from "../todo-category/todo-category.repository";

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
	private readonly logger = new Logger(TodoService.name);

	constructor(
		private readonly todoRepository: TodoRepository,
		private readonly todoCategoryRepository: TodoCategoryRepository,
		private readonly paginationService: PaginationService,
		private readonly followService: FollowService,
		private readonly eventEmitter: EventEmitter2,
		private readonly database: DatabaseService,
	) {}

	/**
	 * Todo 생성
	 */
	async create(data: CreateTodoData): Promise<Todo> {
		// 카테고리 존재 및 소유권 확인
		const category = await this.todoCategoryRepository.findByIdAndUserId(
			data.categoryId,
			data.userId,
		);

		if (!category) {
			throw BusinessExceptions.todoCategoryNotFound(data.categoryId);
		}

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

		this.logger.log(`Todo created: ${todo.id} for user: ${data.userId}`);

		return TodoMapper.toResponse(todo);
	}

	/**
	 * 단일 Todo 조회
	 */
	async findById(id: number, userId: string): Promise<Todo> {
		const todo = await this.todoRepository.findByIdAndUserId(id, userId);

		if (!todo) {
			throw BusinessExceptions.todoNotFound(id);
		}

		this.logger.debug(`Todo retrieved: ${id} for user: ${userId}`);

		return TodoMapper.toResponse(todo);
	}

	/**
	 * Todo 목록 조회 (커서 기반 페이지네이션)
	 */
	async findMany(
		params: GetTodosParams,
	): Promise<CursorPaginatedResponse<Todo, number>> {
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

		this.logger.debug(
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

		this.logger.debug(
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
			const category = await this.todoCategoryRepository.findByIdAndUserId(
				data.categoryId,
				userId,
			);
			if (!category) {
				throw BusinessExceptions.todoCategoryNotFound(data.categoryId);
			}
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

		this.logger.log(`Todo updated: ${id} for user: ${userId}`);

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

		this.logger.log(`Todo deleted: ${id} for user: ${userId}`);
	}

	// ===== 액션별 수정 메서드 (SRP) =====

	/**
	 * Todo 완료 상태 토글
	 */
	async toggleComplete(
		id: number,
		userId: string,
		data: { completed: boolean },
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

		this.logger.log(
			`Todo completion toggled: ${id} -> ${data.completed} for user: ${userId}`,
		);

		// 완료로 변경된 경우, 오늘 할일 전체 완료 여부 확인 후 이벤트 발행
		if (data.completed) {
			await this.checkAndEmitAllCompletedEvent(userId);
		}

		return TodoMapper.toResponse(updatedTodo);
	}

	/**
	 * 오늘 할일 전체 완료 시 이벤트 발행
	 * @private
	 */
	private async checkAndEmitAllCompletedEvent(userId: string): Promise<void> {
		try {
			const stats = await this.todoRepository.getTodayTodoStats(userId);

			// 오늘 할일이 있고, 모두 완료된 경우
			if (stats.total > 0 && stats.total === stats.completed) {
				this.logger.log(
					`User ${userId} completed all ${stats.completed} todos today!`,
				);

				// 1. 본인에게 전체 완료 이벤트 발행
				this.eventEmitter.emit(NotificationEvents.TODO_ALL_COMPLETED, {
					userId,
					completedCount: stats.completed,
				} satisfies TodoAllCompletedEventPayload);

				// 2. 친구들에게 알림 이벤트 발행
				const [friendIds, userName] = await Promise.all([
					this.todoRepository.getMutualFriendIds(userId),
					this.todoRepository.getUserName(userId),
				]);

				if (friendIds.length > 0) {
					this.eventEmitter.emit(NotificationEvents.FRIEND_COMPLETED, {
						friendId: userId,
						friendName: userName ?? "친구",
						notifyUserIds: friendIds,
					} satisfies FriendCompletedEventPayload);

					this.logger.log(
						`Friend completed event emitted to ${friendIds.length} friends`,
					);
				}
			}
		} catch (error) {
			// 이벤트 발행 실패가 메인 로직에 영향을 주지 않도록 로깅만 수행
			this.logger.error(
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

		this.logger.log(
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
		const category = await this.todoCategoryRepository.findByIdAndUserId(
			data.categoryId,
			userId,
		);

		if (!category) {
			throw BusinessExceptions.todoCategoryNotFound(data.categoryId);
		}

		const updatedTodo = await this.todoRepository.update(id, {
			category: { connect: { id: data.categoryId } },
		});

		this.logger.log(
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
	): Promise<Todo> {
		const todo = await this.todoRepository.findByIdAndUserId(id, userId);

		if (!todo) {
			throw BusinessExceptions.todoNotFound(id);
		}

		const updatedTodo = await this.todoRepository.update(id, {
			startDate: toDate(data.startDate),
			endDate: data.endDate ? toDate(data.endDate) : null,
			scheduledTime: data.scheduledTime
				? toDate(`1970-01-01T${data.scheduledTime}:00Z`)
				: null,
			isAllDay: data.isAllDay ?? true,
		});

		this.logger.log(`Todo schedule updated: ${id} for user: ${userId}`);

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

		this.logger.log(`Todo content updated: ${id} for user: ${userId}`);

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
		const todo = await this.todoRepository.findByIdAndUserId(id, userId);

		if (!todo) {
			throw BusinessExceptions.todoNotFound(id);
		}

		// 자기 자신을 target으로 지정한 경우 무시
		if (data.targetTodoId === id) {
			return TodoMapper.toResponse(todo);
		}

		return await this.database.$transaction(async (tx) => {
			let newSortOrder: number;

			if (data.targetTodoId === undefined) {
				// targetTodoId가 없는 경우: 맨 처음 또는 맨 끝으로 이동
				if (data.position === "before") {
					// 맨 처음으로 이동
					await this.todoRepository.incrementSortOrdersFrom(userId, 0, tx);
					newSortOrder = 0;
				} else {
					// 맨 끝으로 이동
					const maxSortOrder = await this.todoRepository.getMaxSortOrder(
						userId,
						tx,
					);
					newSortOrder = maxSortOrder + 1;
				}
			} else {
				// targetTodoId가 있는 경우: target 앞 또는 뒤로 이동
				const targetTodo = await this.todoRepository.findByIdAndUserId(
					data.targetTodoId,
					userId,
					tx,
				);

				if (!targetTodo) {
					throw BusinessExceptions.todoReorderTargetNotFound(data.targetTodoId);
				}

				if (data.position === "before") {
					// target 앞으로 이동
					newSortOrder = targetTodo.sortOrder;
					await this.todoRepository.incrementSortOrdersFrom(
						userId,
						newSortOrder,
						tx,
					);
				} else {
					// target 뒤로 이동
					newSortOrder = targetTodo.sortOrder + 1;
					await this.todoRepository.incrementSortOrdersFrom(
						userId,
						newSortOrder,
						tx,
					);
				}
			}

			const updatedTodo = await this.todoRepository.updateSortOrder(
				id,
				newSortOrder,
				tx,
			);

			this.logger.log(
				`Todo reordered: ${id} to sortOrder ${newSortOrder} for user: ${userId}`,
			);

			return TodoMapper.toResponse(updatedTodo);
		});
	}
}
