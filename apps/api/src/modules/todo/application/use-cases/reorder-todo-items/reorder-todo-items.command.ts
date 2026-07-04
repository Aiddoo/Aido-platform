import type { Todo as TodoResponse } from "@aido/validators";
import { Command } from "@nestjs/cqrs";

export class ReorderTodoItemsCommand extends Command<TodoResponse> {
	constructor(
		public readonly todoId: number,
		public readonly userId: string,
		public readonly itemIds: number[],
	) {
		super();
	}
}
