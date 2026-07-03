import { Query } from "@nestjs/cqrs";

/** 카테고리당 활성 Todo 리소스 제한 조회 결과 — 쿼리가 계약(반환 타입)을 소유합니다 */
export interface TodoResourceLimitResult {
	activeCount?: number;
	maxPerCategory: number;
}

/**
 * 카테고리당 활성 Todo 리소스 제한 정보 조회 쿼리
 */
export class GetTodoResourceLimitQuery extends Query<TodoResourceLimitResult> {
	constructor(
		public readonly userId: string,
		public readonly categoryId?: number,
	) {
		super();
	}
}
