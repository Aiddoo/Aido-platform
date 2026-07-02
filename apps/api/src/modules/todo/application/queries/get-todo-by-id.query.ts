/**
 * 단일 Todo 조회 쿼리
 */
export class GetTodoByIdQuery {
	constructor(
		public readonly id: number,
		public readonly userId: string,
	) {}
}
