import {
  type CreateTodoItemInput,
  type ReorderTodoItemsInput,
  updateTodoResponseSchema,
  type UpdateTodoItemInput,
} from '@aido/api';
import type { HttpClient } from '@src/core/ports/http';
import type { ApiError } from '@src/shared/errors/api-error';
import { ParseError } from '@src/shared/errors/infra-error';
import { ok, type Result } from '@src/shared/errors/result';

import type { TodoItem } from '../models/todo.model';
import { toTodoItem } from './todo.mapper';

export class SubTodoService {
  readonly #httpClient: HttpClient;

  constructor(httpClient: HttpClient) {
    this.#httpClient = httpClient;
  }

  addSubTodo = async (
    todoId: number,
    body: CreateTodoItemInput,
  ): Promise<Result<TodoItem, ApiError>> => {
    const result = await this.#httpClient.post(`v1/todos/${todoId}/items`, body);

    if (!result.ok) {
      return result;
    }

    const parsed = updateTodoResponseSchema.safeParse(result.value);
    if (!parsed.success) {
      throw new ParseError(`[SubTodoService] Invalid addSubTodo response: ${parsed.error.message}`);
    }

    return ok(toTodoItem(parsed.data.todo));
  };

  updateSubTodo = async (
    todoId: number,
    subTodoId: number,
    body: UpdateTodoItemInput,
  ): Promise<Result<TodoItem, ApiError>> => {
    const result = await this.#httpClient.patch(`v1/todos/${todoId}/items/${subTodoId}`, body);

    if (!result.ok) {
      return result;
    }

    const parsed = updateTodoResponseSchema.safeParse(result.value);
    if (!parsed.success) {
      throw new ParseError(
        `[SubTodoService] Invalid updateSubTodo response: ${parsed.error.message}`,
      );
    }

    return ok(toTodoItem(parsed.data.todo));
  };

  deleteSubTodo = async (
    todoId: number,
    subTodoId: number,
  ): Promise<Result<TodoItem, ApiError>> => {
    const result = await this.#httpClient.delete(`v1/todos/${todoId}/items/${subTodoId}`);

    if (!result.ok) {
      return result;
    }

    const parsed = updateTodoResponseSchema.safeParse(result.value);
    if (!parsed.success) {
      throw new ParseError(
        `[SubTodoService] Invalid deleteSubTodo response: ${parsed.error.message}`,
      );
    }

    return ok(toTodoItem(parsed.data.todo));
  };

  reorderSubTodos = async (
    todoId: number,
    body: ReorderTodoItemsInput,
  ): Promise<Result<TodoItem, ApiError>> => {
    const result = await this.#httpClient.patch(`v1/todos/${todoId}/items/reorder`, body);

    if (!result.ok) {
      return result;
    }

    const parsed = updateTodoResponseSchema.safeParse(result.value);
    if (!parsed.success) {
      throw new ParseError(
        `[SubTodoService] Invalid reorderSubTodos response: ${parsed.error.message}`,
      );
    }

    return ok(toTodoItem(parsed.data.todo));
  };
}
