import type { Todo as TodoResponse } from "@aido/validators";
import { Injectable } from "@nestjs/common";
import { CommandBus } from "@nestjs/cqrs";
import {
	CreateRecurringTodosCommand,
	type CreateRecurringTodosResult,
	CreateTodoCommand,
} from "@/todo";
import type {
	CreateRecurringTodoData,
	CreateTodoData,
	TodoCreatorPort,
} from "../../application/ports/todo-creator.port";

/**
 * TodoCreatorPort 어댑터 — todo 모듈 커맨드 디스패치로 구현.
 *
 * 임시 구현 — todo 전환 커밋에서 TodoFacade 주입으로 교체 예정.
 */
@Injectable()
export class TodoCreatorAdapter implements TodoCreatorPort {
	constructor(private readonly commandBus: CommandBus) {}

	createTodo(data: CreateTodoData): Promise<TodoResponse> {
		return this.commandBus.execute(new CreateTodoCommand(data));
	}

	createRecurringTodos(
		data: CreateRecurringTodoData,
		timezone: string,
	): Promise<CreateRecurringTodosResult> {
		return this.commandBus.execute(
			new CreateRecurringTodosCommand(data, timezone),
		);
	}
}
