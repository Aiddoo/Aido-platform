import type { Todo as TodoResponse } from "@aido/validators";
import { Command } from "@nestjs/cqrs";
import type { CreateRecurringTodoData } from "../../../types/todo.types";

/** 반복 생성 결과 read model — 커맨드가 계약(반환 타입)을 소유합니다 */
export interface CreateRecurringTodosResult {
	todos: TodoResponse[];
	count: number;
}

export class CreateRecurringTodosCommand extends Command<CreateRecurringTodosResult> {
	constructor(
		public readonly data: CreateRecurringTodoData,
		public readonly timezone: string,
	) {
		super();
	}
}
