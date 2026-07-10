import type { TodoCategoryWithCountView } from "./todo-category.repository.port";

/**
 * TodoCategoryCachePort — 카테고리 목록 캐시 포트.
 *
 * 카테고리 목록은 조회가 잦고 변경이 드문 read-hot 데이터라 캐시 대상이다(레거시와 동일 정책).
 * 생성/수정/삭제/재배치 시 무효화한다. 미이관 shared CacheService를 감싼 어댑터가 구현한다.
 */

export const TODO_CATEGORY_CACHE = Symbol("TODO_CATEGORY_CACHE");

export interface TodoCategoryCachePort {
	/** 목록 캐시 read-through (miss 시 factory 실행 후 저장) */
	wrapList(
		userId: string,
		factory: () => Promise<TodoCategoryWithCountView[]>,
	): Promise<TodoCategoryWithCountView[]>;
	/** 사용자 카테고리 목록 캐시 무효화 */
	invalidate(userId: string): Promise<void>;
}
