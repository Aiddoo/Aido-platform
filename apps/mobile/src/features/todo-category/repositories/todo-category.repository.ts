import type { TodoCategoryListResponse } from '@aido/validators';

export interface TodoCategoryRepository {
  /** 카테고리 목록 조회 */
  getCategories(): Promise<TodoCategoryListResponse>;
}
