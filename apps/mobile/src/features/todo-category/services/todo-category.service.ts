import type { TodoCategoryListResponse } from '@aido/validators';

import type { TodoCategoryItem } from '../models/todo-category.model';
import type { TodoCategoryRepository } from '../repositories/todo-category.repository';

import { toTodoCategoryItems } from './todo-category.mapper';

export class TodoCategoryService {
  constructor(private readonly _repository: TodoCategoryRepository) {}

  /** 카테고리 목록 조회 */
  async getCategories(): Promise<TodoCategoryItem[]> {
    const response: TodoCategoryListResponse = await this._repository.getCategories();
    return toTodoCategoryItems(response.items);
  }
}
