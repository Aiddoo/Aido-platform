import type { Todo as TodoResponse } from "@aido/validators";
import { Command } from "@nestjs/cqrs";

export class AddTodoItemCommand extends Command<TodoResponse> {
	constructor(
		public readonly todoId: number,
		public readonly userId: string,
		public readonly title: string,
	) {
		super();
	}
}
