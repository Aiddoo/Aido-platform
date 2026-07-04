import { Command } from "@nestjs/cqrs";

export class DeleteTodoCommand extends Command<void> {
	constructor(
		public readonly id: number,
		public readonly userId: string,
	) {
		super();
	}
}
