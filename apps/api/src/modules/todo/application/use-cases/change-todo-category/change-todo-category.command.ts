import type { Todo as TodoResponse } from "@aido/validators";
import { Command } from "@nestjs/cqrs";

export class ChangeTodoCategoryCommand extends Command<TodoResponse> {
	constructor(
		public readonly id: number,
		public readonly userId: string,
		public readonly categoryId: number,
	) {
		super();
	}
}
