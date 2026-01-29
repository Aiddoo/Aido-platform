import { type TodoCategoryListResponse, todoCategoryListResponseSchema } from '@aido/validators';
import type { HttpClient } from '@src/core/ports/http';

import type { TodoCategoryRepository } from './todo-category.repository';

export class TodoCategoryRepositoryImpl implements TodoCategoryRepository {
  constructor(private readonly _httpClient: HttpClient) {}

  async getCategories(): Promise<TodoCategoryListResponse> {
    const { data } = await this._httpClient.get<TodoCategoryListResponse>('v1/todo-categories');

    const result = todoCategoryListResponseSchema.safeParse(data);
    if (!result.success) {
      console.error('[TodoCategoryRepository] Invalid getCategories response:', result.error);
      throw new Error('Invalid category data from server');
    }

    return result.data;
  }
}
