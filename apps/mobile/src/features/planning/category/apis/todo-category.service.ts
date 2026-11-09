import {
  createTodoCategoryResponseSchema,
  deleteTodoCategoryResponseSchema,
  reorderTodoCategoryResponseSchema,
  todoCategoryListResponseSchema,
  updateTodoCategoryResponseSchema,
} from '@aido/api';
import type { HttpClient } from '@src/core/ports/http-client';
import { parseApiResponse } from '@src/shared/errors/parse-api-response';
import { noop } from 'es-toolkit';

import type { TodoCategoryFormValues } from '../schemas/todo-category-form.schema';
import type {
  TodoCategoryChange,
  TodoCategoryRemoval,
  TodoCategoryReorder,
} from '../schemas/todo-category-request.schema';
import { toTodoCategory, toTodoCategoryWithCounts } from './todo-category.mapper';

export class TodoCategoryService {
  readonly #httpClient: HttpClient;

  constructor(httpClient: HttpClient) {
    this.#httpClient = httpClient;
  }

  getCategories = async (signal?: AbortSignal) =>
    parseApiResponse(
      await this.#httpClient.get('v1/todo-categories', { signal }),
      todoCategoryListResponseSchema,
      (dto) => ({ categories: toTodoCategoryWithCounts(dto.items) }),
      '[TodoCategoryService] Invalid getCategories response',
    );

  createCategory = async (input: TodoCategoryFormValues) =>
    parseApiResponse(
      await this.#httpClient.post('v1/todo-categories', input),
      createTodoCategoryResponseSchema,
      (dto) => toTodoCategory(dto.category),
      '[TodoCategoryService] Invalid createCategory response',
    );

  updateCategory = async (id: number, input: TodoCategoryChange) =>
    parseApiResponse(
      await this.#httpClient.patch(`v1/todo-categories/${id}`, input),
      updateTodoCategoryResponseSchema,
      (dto) => toTodoCategory(dto.category),
      '[TodoCategoryService] Invalid updateCategory response',
    );

  deleteCategory = async (id: number, query?: TodoCategoryRemoval) =>
    parseApiResponse(
      await this.#httpClient.delete(`v1/todo-categories/${id}`, {
        params: { moveToCategoryId: query?.moveToCategoryId },
      }),
      deleteTodoCategoryResponseSchema,
      noop,
      '[TodoCategoryService] Invalid deleteCategory response',
    );

  reorderCategory = async (id: number, input: TodoCategoryReorder) =>
    parseApiResponse(
      await this.#httpClient.patch(`v1/todo-categories/${id}/reorder`, input),
      reorderTodoCategoryResponseSchema,
      (dto) => toTodoCategory(dto.category),
      '[TodoCategoryService] Invalid reorderCategory response',
    );
}
