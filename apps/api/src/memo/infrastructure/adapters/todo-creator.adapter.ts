import type { Todo as TodoResponse } from "@aido/validators";
import { Injectable } from "@nestjs/common";
import { type CreateRecurringTodosResult, TodoFacade } from "@/todo";
import type {
	CreateRecurringTodoData,
	CreateTodoData,
	TodoCreatorPort,
} from "../../application/ports/todo-creator.port";

/**
 * TodoCreatorPort 어댑터 — todo의 공개 Facade에 위임해 구현.
 */
@Injectable()
export class TodoCreatorAdapter implements TodoCreatorPort {
	constructor(private readonly todoFacade: TodoFacade) {}

	createTodo(data: CreateTodoData): Promise<TodoResponse> {
		return this.todoFacade.create(data);
	}

	createRecurringTodos(
		data: CreateRecurringTodoData,
		timezone: string,
	): Promise<CreateRecurringTodosResult> {
		return this.todoFacade.createRecurring(data, timezone);
	}
}
