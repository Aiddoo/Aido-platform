import type { TodoVisibility } from "../../../domain/entities/todo.entity";

export class UpdateTodoVisibilityCommand {
	constructor(
		public readonly id: number,
		public readonly userId: string,
		public readonly visibility: TodoVisibility,
	) {}
}
