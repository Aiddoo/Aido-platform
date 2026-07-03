import type { CreateRecurringTodoData } from "../../../types/todo.types";

export class CreateRecurringTodosCommand {
	constructor(
		public readonly data: CreateRecurringTodoData,
		public readonly timezone: string,
	) {}
}
