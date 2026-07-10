import type { ReorderPosition, Todo as TodoResponse } from "@aido/validators";
import { Injectable } from "@nestjs/common";
import { CommandBus, QueryBus } from "@nestjs/cqrs";
import type { CursorPaginatedResponse } from "@/shared/application/pagination";
import type { TodoVisibility } from "../../domain/entities/todo.entity";
import type { TodoScheduleProps } from "../../domain/value-objects/todo-schedule.vo";
import { GetFriendTodosQuery } from "../queries/get-friend-todos.query";
import { GetTodoByIdQuery } from "../queries/get-todo-by-id.query";
import {
	GetTodoResourceLimitQuery,
	type TodoResourceLimitResult,
} from "../queries/get-todo-resource-limit.query";
import { GetTodosQuery } from "../queries/get-todos.query";
import type {
	CreateRecurringTodoData,
	CreateTodoData,
	GetFriendTodosParams,
	GetTodosParams,
	UpdateTodoData,
} from "../types";
import { AddTodoItemCommand } from "../use-cases/add-todo-item/add-todo-item.command";
import { ChangeTodoCategoryCommand } from "../use-cases/change-todo-category/change-todo-category.command";
import {
	CreateRecurringTodosCommand,
	type CreateRecurringTodosResult,
} from "../use-cases/create-recurring-todos/create-recurring-todos.command";
import { CreateTodoCommand } from "../use-cases/create-todo/create-todo.command";
import { DeleteTodoCommand } from "../use-cases/delete-todo/delete-todo.command";
import { DeleteTodoItemCommand } from "../use-cases/delete-todo-item/delete-todo-item.command";
import { ReorderTodoCommand } from "../use-cases/reorder-todo/reorder-todo.command";
import { ReorderTodoItemsCommand } from "../use-cases/reorder-todo-items/reorder-todo-items.command";
import { ToggleTodoCompleteCommand } from "../use-cases/toggle-todo-complete/toggle-todo-complete.command";
import { UpdateTodoCommand } from "../use-cases/update-todo/update-todo.command";
import { UpdateTodoItemCommand } from "../use-cases/update-todo-item/update-todo-item.command";
import { UpdateTodoScheduleCommand } from "../use-cases/update-todo-schedule/update-todo-schedule.command";
import { UpdateTodoTitleCommand } from "../use-cases/update-todo-title/update-todo-title.command";
import { UpdateTodoVisibilityCommand } from "../use-cases/update-todo-visibility/update-todo-visibility.command";

/**
 * Todo 애플리케이션 서비스(Facade) — 컨트롤러와 CQRS 버스 사이의 얇은 seam.
 *
 * 컨트롤러는 이 Facade만 주입받고, DTO→도메인 원시값 매핑(타임존/날짜 파싱)만
 * 담당한다. 커맨드/쿼리 조립과 버스 디스패치는 전부 여기서 흡수한다.
 * 도메인 규칙은 각 핸들러가, 반환 타입은 Command<T>/Query<T> 제네릭이 추론한다.
 */
@Injectable()
export class TodoFacade {
	constructor(
		private readonly commandBus: CommandBus,
		private readonly queryBus: QueryBus,
	) {}

	// ===== Queries =====

	getResourceLimit(
		userId: string,
		categoryId?: number,
	): Promise<TodoResourceLimitResult> {
		return this.queryBus.execute(
			new GetTodoResourceLimitQuery(userId, categoryId),
		);
	}

	findMany(
		params: GetTodosParams,
	): Promise<CursorPaginatedResponse<TodoResponse, number>> {
		return this.queryBus.execute(new GetTodosQuery(params));
	}

	findById(id: number, userId: string): Promise<TodoResponse> {
		return this.queryBus.execute(new GetTodoByIdQuery(id, userId));
	}

	findFriendTodos(
		params: GetFriendTodosParams,
	): Promise<CursorPaginatedResponse<TodoResponse, number>> {
		return this.queryBus.execute(new GetFriendTodosQuery(params));
	}

	// ===== Commands =====

	create(data: CreateTodoData): Promise<TodoResponse> {
		return this.commandBus.execute(new CreateTodoCommand(data));
	}

	createRecurring(
		data: CreateRecurringTodoData,
		timezone: string,
	): Promise<CreateRecurringTodosResult> {
		return this.commandBus.execute(
			new CreateRecurringTodosCommand(data, timezone),
		);
	}

	update(
		id: number,
		userId: string,
		data: UpdateTodoData,
	): Promise<TodoResponse> {
		return this.commandBus.execute(new UpdateTodoCommand(id, userId, data));
	}

	toggleComplete(
		id: number,
		userId: string,
		completed: boolean,
		timezone: string,
	): Promise<TodoResponse> {
		return this.commandBus.execute(
			new ToggleTodoCompleteCommand(id, userId, completed, timezone),
		);
	}

	updateVisibility(
		id: number,
		userId: string,
		visibility: TodoVisibility,
	): Promise<TodoResponse> {
		return this.commandBus.execute(
			new UpdateTodoVisibilityCommand(id, userId, visibility),
		);
	}

	updateCategory(
		id: number,
		userId: string,
		categoryId: number,
	): Promise<TodoResponse> {
		return this.commandBus.execute(
			new ChangeTodoCategoryCommand(id, userId, categoryId),
		);
	}

	updateSchedule(
		id: number,
		userId: string,
		schedule: TodoScheduleProps,
	): Promise<TodoResponse> {
		return this.commandBus.execute(
			new UpdateTodoScheduleCommand(id, userId, schedule),
		);
	}

	updateTitle(
		id: number,
		userId: string,
		title: string,
	): Promise<TodoResponse> {
		return this.commandBus.execute(
			new UpdateTodoTitleCommand(id, userId, title),
		);
	}

	reorder(
		id: number,
		userId: string,
		targetTodoId: number | undefined,
		position: ReorderPosition,
	): Promise<TodoResponse> {
		return this.commandBus.execute(
			new ReorderTodoCommand(id, userId, targetTodoId, position),
		);
	}

	deleteTodo(id: number, userId: string): Promise<void> {
		return this.commandBus.execute(new DeleteTodoCommand(id, userId));
	}

	// ===== Items (체크리스트) =====

	addItem(id: number, userId: string, title: string): Promise<TodoResponse> {
		return this.commandBus.execute(new AddTodoItemCommand(id, userId, title));
	}

	reorderItems(
		id: number,
		userId: string,
		itemIds: number[],
	): Promise<TodoResponse> {
		return this.commandBus.execute(
			new ReorderTodoItemsCommand(id, userId, itemIds),
		);
	}

	updateItem(
		todoId: number,
		itemId: number,
		userId: string,
		data: { title?: string; completed?: boolean },
	): Promise<TodoResponse> {
		return this.commandBus.execute(
			new UpdateTodoItemCommand(todoId, itemId, userId, data),
		);
	}

	deleteItem(
		todoId: number,
		itemId: number,
		userId: string,
	): Promise<TodoResponse> {
		return this.commandBus.execute(
			new DeleteTodoItemCommand(todoId, itemId, userId),
		);
	}
}
