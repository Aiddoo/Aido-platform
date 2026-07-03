import type { Todo as TodoResponse } from "@aido/validators";
import { Query } from "@nestjs/cqrs";

/**
 * 단일 Todo 조회 쿼리
 */
export class GetTodoByIdQuery extends Query<TodoResponse> {
	constructor(
		public readonly id: number,
		public readonly userId: string,
	) {
		super();
	}
}
