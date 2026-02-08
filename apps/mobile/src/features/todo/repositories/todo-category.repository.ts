import type {
  CreateTodoCategoryInput,
  DeleteTodoCategoryQuery,
  ReorderTodoCategoryInput,
  UpdateTodoCategoryInput,
} from '@aido/validators';
import type { ApiError } from '@src/shared/errors/api-error';
import type { Result } from '@src/shared/errors/result';

import type { TodoCategoriesResult, TodoCategory } from '../models/todo-category.model';

export interface TodoCategoryRepository {
  getCategories(): Promise<Result<TodoCategoriesResult, ApiError>>;
  createCategory(input: CreateTodoCategoryInput): Promise<Result<TodoCategory, ApiError>>;
  updateCategory(
    id: number,
    input: UpdateTodoCategoryInput,
  ): Promise<Result<TodoCategory, ApiError>>;
  deleteCategory(id: number, query?: DeleteTodoCategoryQuery): Promise<Result<void, ApiError>>;
  reorderCategory(
    id: number,
    input: ReorderTodoCategoryInput,
  ): Promise<Result<TodoCategory, ApiError>>;
}
