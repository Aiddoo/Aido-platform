import {
  type CreateTodoCategoryInput,
  type CreateTodoCategoryResponse,
  createTodoCategoryResponseSchema,
  type DeleteTodoCategoryQuery,
  type DeleteTodoCategoryResponse,
  deleteTodoCategoryResponseSchema,
  type TodoCategoryListResponse,
  todoCategoryListResponseSchema,
  type UpdateTodoCategoryInput,
  type UpdateTodoCategoryResponse,
  updateTodoCategoryResponseSchema,
} from '@aido/validators';
import type { HttpClient } from '@src/core/ports/http';
import type { ApiError } from '@src/shared/errors/api-error';
import { ParseError } from '@src/shared/errors/infra-error';
import { ok, type Result } from '@src/shared/errors/result';

import type { TodoCategoriesResult, TodoCategory } from '../models/todo-category.model';
import { toTodoCategory, toTodoCategoryWithCounts } from './todo-category.mapper';
import type { TodoCategoryRepository } from './todo-category.repository';

export class TodoCategoryRepositoryImpl implements TodoCategoryRepository {
  readonly #httpClient: HttpClient;

  constructor(httpClient: HttpClient) {
    this.#httpClient = httpClient;
  }

  async getCategories(): Promise<Result<TodoCategoriesResult, ApiError>> {
    const result = await this.#httpClient.get<TodoCategoryListResponse>('v1/todo-categories');

    if (!result.ok) return result;

    const parsed = todoCategoryListResponseSchema.safeParse(result.value);
    if (!parsed.success) {
      console.error('[TodoCategoryRepository] Invalid getCategories response:', parsed.error);
      throw new ParseError();
    }

    return ok({
      categories: toTodoCategoryWithCounts(parsed.data.items),
    });
  }

  async createCategory(input: CreateTodoCategoryInput): Promise<Result<TodoCategory, ApiError>> {
    const result = await this.#httpClient.post<CreateTodoCategoryResponse>(
      'v1/todo-categories',
      input,
    );

    if (!result.ok) return result;

    const parsed = createTodoCategoryResponseSchema.safeParse(result.value);
    if (!parsed.success) {
      console.error('[TodoCategoryRepository] Invalid createCategory response:', parsed.error);
      throw new ParseError();
    }

    return ok(toTodoCategory(parsed.data.category));
  }

  async updateCategory(
    id: number,
    input: UpdateTodoCategoryInput,
  ): Promise<Result<TodoCategory, ApiError>> {
    const result = await this.#httpClient.patch<UpdateTodoCategoryResponse>(
      `v1/todo-categories/${id}`,
      input,
    );

    if (!result.ok) return result;

    const parsed = updateTodoCategoryResponseSchema.safeParse(result.value);
    if (!parsed.success) {
      console.error('[TodoCategoryRepository] Invalid updateCategory response:', parsed.error);
      throw new ParseError();
    }

    return ok(toTodoCategory(parsed.data.category));
  }

  async deleteCategory(
    id: number,
    query?: DeleteTodoCategoryQuery,
  ): Promise<Result<void, ApiError>> {
    const result = await this.#httpClient.delete<DeleteTodoCategoryResponse>(
      `v1/todo-categories/${id}`,
      {
        params: { moveToCategoryId: query?.moveToCategoryId },
      },
    );

    if (!result.ok) return result;

    const parsed = deleteTodoCategoryResponseSchema.safeParse(result.value);
    if (!parsed.success) {
      console.error('[TodoCategoryRepository] Invalid deleteCategory response:', parsed.error);
      throw new ParseError();
    }

    return ok(undefined);
  }
}
