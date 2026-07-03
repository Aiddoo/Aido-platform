import type { ReorderPosition, Todo as TodoResponse } from "@aido/validators";
import { Command } from "@nestjs/cqrs";

export class ReorderTodoCommand extends Command<TodoResponse> {
	constructor(
		public readonly id: number,
		public readonly userId: string,
		public readonly targetTodoId: number | undefined,
		public readonly position: ReorderPosition,
	) {
		super();
	}
}
