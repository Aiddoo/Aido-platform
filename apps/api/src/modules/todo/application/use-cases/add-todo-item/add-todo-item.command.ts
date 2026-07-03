export class AddTodoItemCommand {
	constructor(
		public readonly todoId: number,
		public readonly userId: string,
		public readonly title: string,
	) {}
}
