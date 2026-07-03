import type { ReorderPosition } from "@aido/validators";

export class ReorderTodoCommand {
	constructor(
		public readonly id: number,
		public readonly userId: string,
		public readonly targetTodoId: number | undefined,
		public readonly position: ReorderPosition,
	) {}
}
