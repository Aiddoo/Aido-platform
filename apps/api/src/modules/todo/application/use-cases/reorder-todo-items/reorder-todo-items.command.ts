export class ReorderTodoItemsCommand {
	constructor(
		public readonly todoId: number,
		public readonly userId: string,
		public readonly itemIds: number[],
	) {}
}
