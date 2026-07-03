import type { UpdateTodoData } from "../../../types/todo.types";

export class UpdateTodoCommand {
	constructor(
		public readonly id: number,
		public readonly userId: string,
		public readonly data: UpdateTodoData,
	) {}
}
