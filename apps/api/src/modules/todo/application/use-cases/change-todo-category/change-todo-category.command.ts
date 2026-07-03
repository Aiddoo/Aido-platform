export class ChangeTodoCategoryCommand {
	constructor(
		public readonly id: number,
		public readonly userId: string,
		public readonly categoryId: number,
	) {}
}
