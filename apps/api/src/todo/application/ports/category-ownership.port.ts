export const CATEGORY_OWNERSHIP = Symbol("CATEGORY_OWNERSHIP");

/**
 * 카테고리 소유권 확인 포트 (todo-category 컨텍스트 경계)
 *
 * 소유권 위반 시 예외를 던집니다(구현체가 기존 검증 로직에 위임).
 */
export interface CategoryOwnershipPort {
	validateOwnership(categoryId: number, userId: string): Promise<void>;
}
