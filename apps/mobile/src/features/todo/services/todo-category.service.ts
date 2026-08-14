import {
  type ChangeTodoCategoryInput,
  type CreateTodoCategoryInput,
  type CreateTodoCategoryResponse,
  createTodoCategoryResponseSchema,
  type DeleteTodoCategoryQuery,
  type DeleteTodoCategoryResponse,
  deleteTodoCategoryResponseSchema,
  type ReorderTodoCategoryInput,
  type ReorderTodoCategoryResponse,
  reorderTodoCategoryResponseSchema,
  type TodoCategoryListResponse,
  todoCategoryListResponseSchema,
  type UpdateTodoCategoryInput,
  type UpdateTodoCategoryResponse,
  updateTodoCategoryResponseSchema,
  updateTodoResponseSchema,
} from '@aido/validators';
import type { HttpClient } from '@src/core/ports/http';
import type { ApiError } from '@src/shared/errors/api-error';
import { ParseError } from '@src/shared/errors/infra-error';
import { ok, type Result } from '@src/shared/errors/result';

import type { TodoCategoriesResult, TodoCategory } from '../models/todo-category.model';
import type { TodoItem } from '../models/todo.model';
import { toTodoCategory, toTodoCategoryWithCounts } from './todo-category.mapper';
import { toTodoItem } from './todo.mapper';

export class TodoCategoryService {
  readonly #httpClient: HttpClient;

  constructor(httpClient: HttpClient) {
    this.#httpClient = httpClient;
  }

  getCategories = async (): Promise<Result<TodoCategoriesResult, ApiError>> => {
    const result = await this.#httpClient.get<TodoCategoryListResponse>('v1/todo-categories');

    if (!result.ok) {
      return result;
    }

    const parsed = todoCategoryListResponseSchema.safeParse(result.value);
    if (!parsed.success) {
      throw new ParseError(
        `[TodoCategoryService] Invalid getCategories response: ${parsed.error.message}`,
      );
    }

    return ok({
      categories: toTodoCategoryWithCounts(parsed.data.items),
    });
  };

  createCategory = async (
    input: CreateTodoCategoryInput,
  ): Promise<Result<TodoCategory, ApiError>> => {
    const result = await this.#httpClient.post<CreateTodoCategoryResponse>(
      'v1/todo-categories',
      input,
    );

    if (!result.ok) {
      return result;
    }

    const parsed = createTodoCategoryResponseSchema.safeParse(result.value);
    if (!parsed.success) {
      throw new ParseError(
        `[TodoCategoryService] Invalid createCategory response: ${parsed.error.message}`,
      );
    }

    return ok(toTodoCategory(parsed.data.category));
  };

  updateCategory = async (
    id: number,
    input: UpdateTodoCategoryInput,
  ): Promise<Result<TodoCategory, ApiError>> => {
    const result = await this.#httpClient.patch<UpdateTodoCategoryResponse>(
      `v1/todo-categories/${id}`,
      input,
    );

    if (!result.ok) {
      return result;
    }

    const parsed = updateTodoCategoryResponseSchema.safeParse(result.value);
    if (!parsed.success) {
      throw new ParseError(
        `[TodoCategoryService] Invalid updateCategory response: ${parsed.error.message}`,
      );
    }

    return ok(toTodoCategory(parsed.data.category));
  };

  deleteCategory = async (
    id: number,
    query?: DeleteTodoCategoryQuery,
  ): Promise<Result<void, ApiError>> => {
    const result = await this.#httpClient.delete<DeleteTodoCategoryResponse>(
      `v1/todo-categories/${id}`,
      {
        params: { moveToCategoryId: query?.moveToCategoryId },
      },
    );

    if (!result.ok) {
      return result;
    }

    const parsed = deleteTodoCategoryResponseSchema.safeParse(result.value);
    if (!parsed.success) {
      throw new ParseError(
        `[TodoCategoryService] Invalid deleteCategory response: ${parsed.error.message}`,
      );
    }

    return ok(undefined);
  };

  changeTodoCategory = async (
    todoId: number,
    input: ChangeTodoCategoryInput,
  ): Promise<Result<TodoItem, ApiError>> => {
    const result = await this.#httpClient.patch(`v1/todos/${todoId}/category`, input);

    if (!result.ok) {
      return result;
    }

    const parsed = updateTodoResponseSchema.safeParse(result.value);
    if (!parsed.success) {
      throw new ParseError(
        `[TodoCategoryService] Invalid changeTodoCategory response: ${parsed.error.message}`,
      );
    }

    return ok(toTodoItem(parsed.data.todo));
  };

  reorderCategory = async (
    id: number,
    input: ReorderTodoCategoryInput,
  ): Promise<Result<TodoCategory, ApiError>> => {
    const result = await this.#httpClient.patch<ReorderTodoCategoryResponse>(
      `v1/todo-categories/${id}/reorder`,
      input,
    );

    if (!result.ok) {
      return result;
    }

    const parsed = reorderTodoCategoryResponseSchema.safeParse(result.value);
    if (!parsed.success) {
      throw new ParseError(
        `[TodoCategoryService] Invalid reorderCategory response: ${parsed.error.message}`,
      );
    }

    return ok(toTodoCategory(parsed.data.category));
  };
}
