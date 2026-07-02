/**
 * 카테고리당 활성 Todo 리소스 제한 정보 조회 쿼리
 */
export class GetTodoResourceLimitQuery {
	constructor(
		public readonly userId: string,
		public readonly categoryId?: number,
	) {}
}
