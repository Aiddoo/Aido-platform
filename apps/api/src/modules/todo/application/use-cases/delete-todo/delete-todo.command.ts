export class DeleteTodoCommand {
	constructor(
		public readonly id: number,
		public readonly userId: string,
	) {}
}
