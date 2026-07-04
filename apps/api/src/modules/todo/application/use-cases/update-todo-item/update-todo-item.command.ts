import type { Todo as TodoResponse } from "@aido/validators";
import { Command } from "@nestjs/cqrs";

export class UpdateTodoItemCommand extends Command<TodoResponse> {
	constructor(
		public readonly todoId: number,
		public readonly itemId: number,
		public readonly userId: string,
		public readonly data: { title?: string; completed?: boolean },
	) {
		super();
	}
}
