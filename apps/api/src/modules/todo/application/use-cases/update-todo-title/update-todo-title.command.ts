export class UpdateTodoTitleCommand {
	constructor(
		public readonly id: number,
		public readonly userId: string,
		public readonly title: string,
	) {}
}
