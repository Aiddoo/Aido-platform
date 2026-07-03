export class UpdateTodoItemCommand {
	constructor(
		public readonly todoId: number,
		public readonly itemId: number,
		public readonly userId: string,
		public readonly data: { title?: string; completed?: boolean },
	) {}
}
