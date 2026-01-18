import { Injectable, Logger } from "@nestjs/common";
import { BusinessExceptions } from "@/common/exception/services/business-exception.service";
import type { CursorPaginatedResponse } from "@/common/pagination/interfaces/pagination.interface";
import { PaginationService } from "@/common/pagination/services/pagination.service";
import type { Todo } from "@/generated/prisma/client";

import { FollowService } from "../follow/follow.service";

import {
	type FindFriendTodosParams,
	type FindTodosParams,
	TodoRepository,
} from "./todo.repository";

export interface CreateTodoData {
	userId: string;
	title: string;
	content?: string | null;
	color?: string | null;
	startDate: Date;
	endDate?: Date | null;
	scheduledTime?: Date | null;
	isAllDay?: boolean;
	visibility?: "PUBLIC" | "PRIVATE";
}

export interface UpdateTodoData {
	title?: string;
	content?: string | null;
	color?: string | null;
	startDate?: Date;
	endDate?: Date | null;
	scheduledTime?: Date | null;
	isAllDay?: boolean;
	visibility?: "PUBLIC" | "PRIVATE";
	completed?: boolean;
}

export interface GetTodosParams {
	userId: string;
	cursor?: number;
	size?: number;
	completed?: boolean;
	startDate?: Date;
	endDate?: Date;
}

export interface GetFriendTodosParams {
	userId: string;
	friendUserId: string;
	cursor?: number;
	size?: number;
	startDate?: Date;
	endDate?: Date;
}

@Injectable()
export class TodoService {
	private readonly logger = new Logger(TodoService.name);

	constructor(
		private readonly todoRepository: TodoRepository,
		private readonly paginationService: PaginationService,
		private readonly followService: FollowService,
	) {}

	/**
	 * Todo 생성
	 */
	async create(data: CreateTodoData): Promise<Todo> {
		const todo = await this.todoRepository.create({
			user: { connect: { id: data.userId } },
			title: data.title,
			content: data.content,
			color: data.color,
			startDate: data.startDate,
			endDate: data.endDate,
			scheduledTime: data.scheduledTime,
			isAllDay: data.isAllDay ?? true,
			visibility: data.visibility ?? "PUBLIC",
		});

		this.logger.log(`Todo created: ${todo.id} for user: ${data.userId}`);

		return todo;
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

		return todo;
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
			startDate: params.startDate,
			endDate: params.endDate,
		};

		const todos = await this.todoRepository.findManyByUserId(repoParams);

		this.logger.debug(
			`Todos listed: ${todos.length} items for user: ${params.userId}`,
		);

		return this.paginationService.createCursorPaginatedResponse<Todo, number>({
			items: todos,
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
			items: todos,
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

		// 완료 상태 변경 시 completedAt 자동 설정
		const updateData: UpdateTodoData & { completedAt?: Date | null } = {
			...data,
		};

		if (data.completed !== undefined) {
			if (data.completed && !todo.completed) {
				// 완료로 변경
				updateData.completedAt = new Date();
			} else if (!data.completed && todo.completed) {
				// 미완료로 변경
				updateData.completedAt = null;
			}
		}

		const updatedTodo = await this.todoRepository.update(id, updateData);

		this.logger.log(`Todo updated: ${id} for user: ${userId}`);

		return updatedTodo;
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
			completedAt: data.completed ? new Date() : null,
		};

		const updatedTodo = await this.todoRepository.update(id, updateData);

		this.logger.log(
			`Todo completion toggled: ${id} -> ${data.completed} for user: ${userId}`,
		);

		return updatedTodo;
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

		return updatedTodo;
	}

	/**
	 * Todo 색상 변경
	 */
	async updateColor(
		id: number,
		userId: string,
		data: { color: string | null },
	): Promise<Todo> {
		const todo = await this.todoRepository.findByIdAndUserId(id, userId);

		if (!todo) {
			throw BusinessExceptions.todoNotFound(id);
		}

		const updatedTodo = await this.todoRepository.update(id, {
			color: data.color,
		});

		this.logger.log(`Todo color updated: ${id} for user: ${userId}`);

		return updatedTodo;
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
			startDate: new Date(data.startDate),
			endDate: data.endDate ? new Date(data.endDate) : null,
			scheduledTime: data.scheduledTime
				? new Date(`1970-01-01T${data.scheduledTime}:00Z`)
				: null,
			isAllDay: data.isAllDay ?? true,
		});

		this.logger.log(`Todo schedule updated: ${id} for user: ${userId}`);

		return updatedTodo;
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

		return updatedTodo;
	}
}
