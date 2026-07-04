import type { Todo as TodoResponse } from "@aido/validators";
import { Command } from "@nestjs/cqrs";

/**
 * Todo 완료 상태 토글 커맨드
 */
export class ToggleTodoCompleteCommand extends Command<TodoResponse> {
	constructor(
		public readonly id: number,
		public readonly userId: string,
		public readonly completed: boolean,
		public readonly timezone: string,
	) {
		super();
	}
}
