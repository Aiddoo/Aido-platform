import type { Todo as TodoResponse } from "@aido/validators";
import { Command } from "@nestjs/cqrs";
import type { UpdateTodoData } from "../../../types/todo.types";

export class UpdateTodoCommand extends Command<TodoResponse> {
	constructor(
		public readonly id: number,
		public readonly userId: string,
		public readonly data: UpdateTodoData,
	) {
		super();
	}
}
