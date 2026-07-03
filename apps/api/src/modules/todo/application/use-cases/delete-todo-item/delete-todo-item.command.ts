export class DeleteTodoItemCommand {
	constructor(
		public readonly todoId: number,
		public readonly itemId: number,
		public readonly userId: string,
	) {}
}
