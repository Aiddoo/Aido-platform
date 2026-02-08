import type {
  CreateTodoCategoryInput,
  DeleteTodoCategoryQuery,
  ReorderTodoCategoryInput,
  UpdateTodoCategoryInput,
} from '@aido/validators';
import type { ApiError } from '@src/shared/errors/api-error';
import type { Result } from '@src/shared/errors/result';

import type { TodoCategoriesResult, TodoCategory } from '../models/todo-category.model';
import type { TodoCategoryRepository } from '../repositories/todo-category.repository';

export class TodoCategoryService {
  readonly #repository: TodoCategoryRepository;

  constructor(repository: TodoCategoryRepository) {
    this.#repository = repository;
  }

  getCategories = async (): Promise<Result<TodoCategoriesResult, ApiError>> => {
    return this.#repository.getCategories();
  };

  createCategory = async (
    input: CreateTodoCategoryInput,
  ): Promise<Result<TodoCategory, ApiError>> => {
    return this.#repository.createCategory(input);
  };

  updateCategory = async (
    id: number,
    input: UpdateTodoCategoryInput,
  ): Promise<Result<TodoCategory, ApiError>> => {
    return this.#repository.updateCategory(id, input);
  };

  deleteCategory = async (
    id: number,
    query?: DeleteTodoCategoryQuery,
  ): Promise<Result<void, ApiError>> => {
    return this.#repository.deleteCategory(id, query);
  };

  reorderCategory = async (
    id: number,
    input: ReorderTodoCategoryInput,
  ): Promise<Result<TodoCategory, ApiError>> => {
    return this.#repository.reorderCategory(id, input);
  };
}
