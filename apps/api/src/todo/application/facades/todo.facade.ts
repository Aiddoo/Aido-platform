import type { ReorderPosition, Todo as TodoResponse } from "@aido/validators";
import { Injectable } from "@nestjs/common";
import type { CursorPaginatedResponse } from "@/shared/application/pagination";
import type { TodoVisibility } from "../../domain/entities/todo.entity";
import type { TodoScheduleProps } from "../../domain/value-objects/todo-schedule.vo";
import { GetFriendTodosUseCase } from "../queries/get-friend-todos/get-friend-todos.use-case";
import { GetTodoByIdUseCase } from "../queries/get-todo-by-id/get-todo-by-id.use-case";
import {
	GetTodoResourceLimitUseCase,
	type TodoResourceLimitResult,
} from "../queries/get-todo-resource-limit/get-todo-resource-limit.use-case";
import {
	GetTodoSummaryUseCase,
	type TodoSummaryResult,
} from "../queries/get-todo-summary/get-todo-summary.use-case";
import { GetTodosUseCase } from "../queries/get-todos/get-todos.use-case";
import type {
	CreateRecurringTodoData,
	CreateTodoData,
	GetFriendTodosParams,
	GetTodosParams,
	UpdateTodoData,
} from "../types";
import { AddTodoItemUseCase } from "../use-cases/add-todo-item/add-todo-item.use-case";
import { ChangeTodoCategoryUseCase } from "../use-cases/change-todo-category/change-todo-category.use-case";
import {
	type CreateRecurringTodosResult,
	CreateRecurringTodosUseCase,
} from "../use-cases/create-recurring-todos/create-recurring-todos.use-case";
import { CreateTodoUseCase } from "../use-cases/create-todo/create-todo.use-case";
import { DeleteTodoUseCase } from "../use-cases/delete-todo/delete-todo.use-case";
import { DeleteTodoItemUseCase } from "../use-cases/delete-todo-item/delete-todo-item.use-case";
import { ReorderTodoUseCase } from "../use-cases/reorder-todo/reorder-todo.use-case";
import { ReorderTodoItemsUseCase } from "../use-cases/reorder-todo-items/reorder-todo-items.use-case";
import { ToggleTodoCompleteUseCase } from "../use-cases/toggle-todo-complete/toggle-todo-complete.use-case";
import { UpdateTodoUseCase } from "../use-cases/update-todo/update-todo.use-case";
import { UpdateTodoItemUseCase } from "../use-cases/update-todo-item/update-todo-item.use-case";
import { UpdateTodoScheduleUseCase } from "../use-cases/update-todo-schedule/update-todo-schedule.use-case";
import { UpdateTodoTitleUseCase } from "../use-cases/update-todo-title/update-todo-title.use-case";
import { UpdateTodoVisibilityUseCase } from "../use-cases/update-todo-visibility/update-todo-visibility.use-case";

/**
 * Todo 애플리케이션 서비스(Facade) — 컨트롤러·크로스 모듈의 유일한 주입 대상.
 *
 * 컨트롤러는 이 Facade만 주입받고, DTO→도메인 원시값 매핑(타임존/날짜 파싱)만
 * 담당한다. 명령/조회는 개별 use-case로 한 줄 위임한다.
 * 도메인 규칙은 각 use-case가 소유한다.
 */
@Injectable()
export class TodoFacade {
	constructor(
		private readonly getTodoResourceLimitUseCase: GetTodoResourceLimitUseCase,
		private readonly getTodoSummaryUseCase: GetTodoSummaryUseCase,
		private readonly getTodosUseCase: GetTodosUseCase,
		private readonly getTodoByIdUseCase: GetTodoByIdUseCase,
		private readonly getFriendTodosUseCase: GetFriendTodosUseCase,
		private readonly createTodoUseCase: CreateTodoUseCase,
		private readonly createRecurringTodosUseCase: CreateRecurringTodosUseCase,
		private readonly updateTodoUseCase: UpdateTodoUseCase,
		private readonly toggleTodoCompleteUseCase: ToggleTodoCompleteUseCase,
		private readonly updateTodoVisibilityUseCase: UpdateTodoVisibilityUseCase,
		private readonly changeTodoCategoryUseCase: ChangeTodoCategoryUseCase,
		private readonly updateTodoScheduleUseCase: UpdateTodoScheduleUseCase,
		private readonly updateTodoTitleUseCase: UpdateTodoTitleUseCase,
		private readonly reorderTodoUseCase: ReorderTodoUseCase,
		private readonly deleteTodoUseCase: DeleteTodoUseCase,
		private readonly addTodoItemUseCase: AddTodoItemUseCase,
		private readonly reorderTodoItemsUseCase: ReorderTodoItemsUseCase,
		private readonly updateTodoItemUseCase: UpdateTodoItemUseCase,
		private readonly deleteTodoItemUseCase: DeleteTodoItemUseCase,
	) {}

	// ===== Queries =====

	getResourceLimit(
		userId: string,
		categoryId?: number,
	): Promise<TodoResourceLimitResult> {
		return this.getTodoResourceLimitUseCase.execute({ userId, categoryId });
	}

	getSummary(userId: string, today: Date): Promise<TodoSummaryResult> {
		return this.getTodoSummaryUseCase.execute({ userId, today });
	}

	findMany(
		params: GetTodosParams,
	): Promise<CursorPaginatedResponse<TodoResponse, number>> {
		return this.getTodosUseCase.execute(params);
	}

	findById(id: number, userId: string): Promise<TodoResponse> {
		return this.getTodoByIdUseCase.execute({ id, userId });
	}

	findFriendTodos(
		params: GetFriendTodosParams,
	): Promise<CursorPaginatedResponse<TodoResponse, number>> {
		return this.getFriendTodosUseCase.execute(params);
	}

	// ===== Commands =====

	create(data: CreateTodoData): Promise<TodoResponse> {
		return this.createTodoUseCase.execute(data);
	}

	createRecurring(
		data: CreateRecurringTodoData,
		timezone: string,
	): Promise<CreateRecurringTodosResult> {
		return this.createRecurringTodosUseCase.execute({ data, timezone });
	}

	update(
		id: number,
		userId: string,
		data: UpdateTodoData,
	): Promise<TodoResponse> {
		return this.updateTodoUseCase.execute({ id, userId, data });
	}

	toggleComplete(
		id: number,
		userId: string,
		completed: boolean,
		timezone: string,
	): Promise<TodoResponse> {
		return this.toggleTodoCompleteUseCase.execute({
			id,
			userId,
			completed,
			timezone,
		});
	}

	updateVisibility(
		id: number,
		userId: string,
		visibility: TodoVisibility,
	): Promise<TodoResponse> {
		return this.updateTodoVisibilityUseCase.execute({ id, userId, visibility });
	}

	updateCategory(
		id: number,
		userId: string,
		categoryId: number,
	): Promise<TodoResponse> {
		return this.changeTodoCategoryUseCase.execute({ id, userId, categoryId });
	}

	updateSchedule(
		id: number,
		userId: string,
		schedule: TodoScheduleProps,
	): Promise<TodoResponse> {
		return this.updateTodoScheduleUseCase.execute({ id, userId, schedule });
	}

	updateTitle(
		id: number,
		userId: string,
		title: string,
	): Promise<TodoResponse> {
		return this.updateTodoTitleUseCase.execute({ id, userId, title });
	}

	reorder(
		id: number,
		userId: string,
		targetTodoId: number | undefined,
		position: ReorderPosition,
	): Promise<TodoResponse> {
		return this.reorderTodoUseCase.execute({
			id,
			userId,
			targetTodoId,
			position,
		});
	}

	deleteTodo(id: number, userId: string): Promise<void> {
		return this.deleteTodoUseCase.execute({ id, userId });
	}

	// ===== Items (체크리스트) =====

	addItem(id: number, userId: string, title: string): Promise<TodoResponse> {
		return this.addTodoItemUseCase.execute({ todoId: id, userId, title });
	}

	reorderItems(
		id: number,
		userId: string,
		itemIds: number[],
	): Promise<TodoResponse> {
		return this.reorderTodoItemsUseCase.execute({
			todoId: id,
			userId,
			itemIds,
		});
	}

	updateItem(
		todoId: number,
		itemId: number,
		userId: string,
		data: { title?: string; completed?: boolean },
	): Promise<TodoResponse> {
		return this.updateTodoItemUseCase.execute({ todoId, itemId, userId, data });
	}

	deleteItem(
		todoId: number,
		itemId: number,
		userId: string,
	): Promise<TodoResponse> {
		return this.deleteTodoItemUseCase.execute({ todoId, itemId, userId });
	}
}
