export const TODO_CACHE = Symbol("TODO_CACHE");

/**
 * Todo 관련 캐시 무효화 포트 (cache 인프라 경계)
 */
export interface TodoCachePort {
	invalidateTodoCategories(userId: string): Promise<void>;
}
