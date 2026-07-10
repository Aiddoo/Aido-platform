import type { Todo as TodoResponse } from "@aido/validators";
import { Command } from "@nestjs/cqrs";
import type { TodoVisibility } from "../../../domain/entities/todo.entity";

export class UpdateTodoVisibilityCommand extends Command<TodoResponse> {
	constructor(
		public readonly id: number,
		public readonly userId: string,
		public readonly visibility: TodoVisibility,
	) {
		super();
	}
}
